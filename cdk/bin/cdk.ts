#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RearchQuestStack } from "../lib/cdk-stack";
import { Tags } from "aws-cdk-lib";

const app = new cdk.App();

new RearchQuestStack(app, "rearch-quest", {
  env: {
    account: "460771252871",
    region: "ap-south-1",
  },
  vpcId: "vpc-000af25537ecd53fb",
});

Tags.of(app).add("Created-by", "sudin.shakya");
Tags.of(app).add("Managed-with", "cdk");
