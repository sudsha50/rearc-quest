import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cert from "aws-cdk-lib/aws-certificatemanager";

export interface RearcQuestStackProps extends StackProps {
  vpcId: string;
}
export class RearcQuestStack extends Stack {
  constructor(scope: Construct, id: string, props?: RearcQuestStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "MyVPC", {
      vpcId: props?.vpcId,
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc,
    });

    const albSg = new ec2.SecurityGroup(this, "SecurityGroupAlb", {
      vpc,
      allowAllOutbound: true,
    });

    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      deletionProtection: false,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const taskRole = new iam.Role(this, "EcsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });

    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "AdminAccess",
        "arn:aws:iam::aws:policy/AdministratorAccess",
      ),
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        cpu: 256,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
        },
        executionRole: taskRole,
        taskRole: taskRole,
      },
    );

    const container = taskDefinition.addContainer("Container", {
      image: ecs.ContainerImage.fromRegistry(
        "460771252871.dkr.ecr.ap-south-1.amazonaws.com/rearc-quest:latest",
      ),
      environment: {
        SECRET_WORD: "SudinIsHired",
      },
    });

    container.addPortMappings({ containerPort: 3000 });

    const ecsSG = new ec2.SecurityGroup(this, "ECSSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });

    ecsSG.addIngressRule(
      ec2.Peer.securityGroupId(albSg.securityGroupId),
      ec2.Port.tcp(80),
    );

    const service = new ecs.FargateService(this, "RearcService", {
      cluster,
      serviceName:"rearc-quest",
      taskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSG],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      healthCheckGracePeriod: Duration.seconds(60),
      enableExecuteCommand: true,
    });

    const scaling = service.autoScaleTaskCount({
      maxCapacity: 2,
      minCapacity: 1,
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpc,
      port: 3000,
      targetType: elbv2.TargetType.IP,
    });

    service.attachToApplicationTargetGroup(targetGroup);

    const listener = alb.addListener("alb-listener", {
      open: true,
      port: 443,
      certificates: [
        cert.Certificate.fromCertificateArn(
          this,
          "SelfCert",
          "arn:aws:acm:ap-south-1:460771252871:certificate/31102193-c548-4a73-bfc6-45cf19a1f306",
        ),
      ],
    });

    listener.addTargetGroups("alb-listener-target-group", {
      targetGroups: [targetGroup],
    });

    const albSG = new ec2.SecurityGroup(this, "alb-SG", {
      vpc,
      allowAllOutbound: true,
    });

    albSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow https traffic",
    );

    alb.addSecurityGroup(albSG);
  }
}
