import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface crGetWafIntegrationURLProps {
  Id: string,
  Name: string,
  Scope: string
}

export class crGetWafIntegrationURL extends Construct {
  public readonly applicationIntegrationURL: string;


  constructor(scope: Construct, id: string, props: crGetWafIntegrationURLProps) {
    super(scope, id);

    const lambdaPolicy = new iam.PolicyDocument({
        statements: [
  
          new iam.PolicyStatement({
            resources: [
              `*`, // TODO improve
            ],
            actions: ["wafv2:*"], // TODO improve
          }),
        ],
      });

    const { managedPolicyArn } = iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole"
    );

    const lambdaRole = new iam.Role(this, "TriggerLERole", {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com")
      ),
      managedPolicies: [
        {
          managedPolicyArn,
        },
      ],
      inlinePolicies: {
        myPolicy: lambdaPolicy,
      },
    });

    const onEvent = new lambda.SingletonFunction(this, 'Singleton', {
      uuid: 'f7d4f730-4ee1-11e8-9c2d-fa7ae01bbebc',      
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "custom_resource.handler",
      timeout: cdk.Duration.seconds(60),
      code: lambda.Code.fromAsset("lambda"),
      role: lambdaRole,
    });

    const myProvider = new cr.Provider(this, 'MyProvider', {
      onEventHandler: onEvent,
      logRetention: logs.RetentionDays.ONE_DAY  
    });

    const resource = new cdk.CustomResource(this, 'Resource1', { serviceToken: myProvider.serviceToken, properties: props });

    this.applicationIntegrationURL = resource.getAtt('ApplicationIntegrationURL').toString();

  }
}