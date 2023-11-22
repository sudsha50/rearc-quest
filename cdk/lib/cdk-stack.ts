import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecspatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

export interface RearchQuestStackProps extends StackProps {
  vpcId: string;
}
export class RearchQuestStack extends Stack {
  constructor(scope: Construct, id: string, props?: RearchQuestStackProps) {
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

    const httplistener = alb.addListener("HttpListener", {
      port: 80,
      open: true,
    });
  
    httplistener.addAction("HttpDefaultAction", {
      action: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        host: "#{host}",
        path: "/#{path}",
        query: "#{query}",
        port: "443",
      }),
    });
    

    const taskRole = new iam.Role(this, "EcsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      cpu: 256,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64
      },
      executionRole:taskRole,
      taskRole:taskRole,
    });
    

    const container = taskDefinition.addContainer("Container", {
      image: ecs.ContainerImage.fromRegistry("460771252871.dkr.ecr.ap-south-1.amazonaws.com/rearc-quest:latest"),
      environment:{
        SECRET_WORD:"SudinIsHired"
      }
    });

    container.addPortMappings({ containerPort: 3000 });


    const ecsSG = new ec2.SecurityGroup(this, "ECSSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });


    ecsSG.addIngressRule(
      ec2.Peer.securityGroupId(albSg.securityGroupId),
      ec2.Port.tcp(80)
    );

    // const service = new ecs.FargateService(this, "RearcService", {
    //   cluster,
    //   taskDefinition,
    //   desiredCount: 1,
    //   securityGroups: [ecsSG],
    //   minHealthyPercent: 100,
    //   maxHealthyPercent: 200,
    //   assignPublicIp: false,
    //   healthCheckGracePeriod: Duration.seconds(60),
    //   enableExecuteCommand: true,
    // });


    // const scaling = service.autoScaleTaskCount({
    //   maxCapacity: 2,
    //   minCapacity: 1,
    // });

    // const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
    //   targets: [service],
    //   protocol: elbv2.ApplicationProtocol.HTTP,
    //   vpc,
    //   port: 3000,
    // });

   
   
  }
}
