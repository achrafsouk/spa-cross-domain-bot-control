import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as waf from "aws-cdk-lib/aws-wafv2";
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { crGetWafIntegrationURL } from './custom-resource';

import { 
  CfnOutput,
} from 'aws-cdk-lib';

interface WafRule {
  Rule: waf.CfnWebACL.RuleProperty;
}

const html = `
<html>
<head><title>My Secure SPA</title></head>
<script type="text/javascript" src="URLPLACEHOLDERchallenge.js" defer></script>
<body>
<h1>My secure SPA</h1>

<button onclick="userAction()">Interact</button>

<div id="container">N/A</div>

<script>
const userAction = async () => {
    const div = document.getElementById('container');
    div.innerHTML = "";
    const response = await AwsWafIntegration.fetch('api/');
    const myJson = await response.json(); 
    div.innerHTML = JSON.stringify(myJson, null, "\t");
}
</script>

</body>
</html>
`

export class SpaCrossDomainWafStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const path = require('node:path');

    const lamdaFunction = new lambda.Function(this, 'lamdaFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join( __dirname,'../lambda')
      ),
      architecture: lambda.Architecture.X86_64,
    });


    const api = new apiGateway.RestApi(this, "api", {
      endpointConfiguration: {
        types: [ apiGateway.EndpointType.REGIONAL ]
      }
      /*defaultCorsPreflightOptions: {
        allowOrigins: apiGateway.Cors.ALL_ORIGINS,
        allowMethods: apiGateway.Cors.ALL_METHODS
      }*/
      
    });
    
    const nextCdkFunctionIntegration = new apiGateway.LambdaIntegration(
      lamdaFunction,
      {
        allowTestInvoke: false
      }
    );
    api.root.addMethod('ANY', nextCdkFunctionIntegration);

    api.root.addProxy({

      defaultIntegration: new apiGateway.LambdaIntegration(lamdaFunction, {
          allowTestInvoke: false
      }),
      anyMethod: true,
    });

    const spaBucket = new s3.Bucket(this, 'spa-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });
  
    const wafRules: WafRule[] = [
      {
        Rule: {
          name: "AWSManagedRulesBotControlRuleSet",
          priority: 1,
          overrideAction: { count: {}},
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesBotControlRuleSet",
              managedRuleGroupConfigs: [
                {
                  awsManagedRulesBotControlRuleSet: { inspectionLevel: "TARGETED"} 
                }
              ]
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesBotControlRuleSet",
          },
        },
      },
      {
        Rule: {
          name: "Block-Requests-With-Missing-Or-Rejected-Token-Label",
          priority: 2,
          action: { count: {}},
          statement: {
            orStatement: {
              statements:
                [
                  { 
                    labelMatchStatement :
                      {
                        scope: 'LABEL',
                        key: 'awswaf:managed:token:absent'
                      }
                  },
                  { 
                    labelMatchStatement :
                      {
                        scope: 'LABEL',
                        key: 'awswaf:managed:token:rejected'
                      }
                  }
                ]
            }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "Block-Requests-With-Missing-Or-Rejected-Token-Label",
          },
        },
      },
      {
        Rule: {
          name: "Send-Upstream-Signal-TGT_VolumetricSessionLow",
          priority: 3,
          action: { 
            count: {
              customRequestHandling: {
                insertHeaders: [
                    {
                      name: 'VolumetricSessionLow',
                      value: 'true'
                    }
                ]
              }
            }
          },
          statement: {
              labelMatchStatement :
              {
                scope: 'LABEL',
                key: 'awswaf:managed:aws:bot-control:targeted:aggregate:volumetric:session:low'
              }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "TGT_VolumetricSessionLow",
          },
        },
      },
      {
        Rule: {
          name: "Send-Upstream-Signal-TGT_VolumetricSessionMedium",
          priority: 4,
          action: { 
            count: {
              customRequestHandling: {
                insertHeaders: [
                    {
                      name: 'VolumetricSessionMedium',
                      value: 'true'
                    }
                ]
              }
            }
          },
          statement: {
              labelMatchStatement :
              {
                scope: 'LABEL',
                key: 'awswaf:managed:aws:bot-control:targeted:aggregate:volumetric:session:medium'
              }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "TGT_VolumetricSessionMedium",
          },
        },
      },
      {
        Rule: {
          name: "Send-Upstream-Signal-TGT_VolumetricSessionHigh",
          priority: 5,
          action: { 
            count: {
              customRequestHandling: {
                insertHeaders: [
                    {
                      name: 'VolumetricSessionHigh',
                      value: 'true'
                    }
                ]
              }
            }
          },
          statement: {
              labelMatchStatement :
              {
                scope: 'LABEL',
                key: 'awswaf:managed:aws:bot-control:targeted:aggregate:volumetric:session:high'
              }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "TGT_VolumetricSessionHigh",
          },
        },
      },
      {
        Rule: {
          name: "Send-Upstream-Signal-TGT_SignalAutomatedBrowser",
          priority: 6,
          action: { 
            count: {
              customRequestHandling: {
                insertHeaders: [
                    {
                      name: 'SignalAutomatedBrowser',
                      value: 'true'
                    }
                ]
              }
            }
          },
          statement: {
              labelMatchStatement :
              {
                scope: 'LABEL',
                key: 'awswaf:managed:aws:bot-control:targeted:signal:automated_browser'
              }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "TGT_SignalAutomatedBrowser",
          },
        },
      },
      {
        Rule: {
          name: "Send-Upstream-Signal-TGT_SignalBrowserInconsistency",
          priority: 7,
          action: { 
            count: {
              customRequestHandling: {
                insertHeaders: [
                    {
                      name: 'SignalBrowserInconsistency',
                      value: 'true'
                    }
                ]
              }
            }
          },
          statement: {
              labelMatchStatement :
              {
                scope: 'LABEL',
                key: 'awswaf:managed:aws:bot-control:targeted:signal:browser_inconsistency'
              }
          },
          visibilityConfig: {
            sampledRequestsEnabled: false,
            cloudWatchMetricsEnabled: true,
            metricName: "TGT_SignalBrowserInconsistency",
          },
        },
      },
    ];


    const apiWebACL = new waf.CfnWebACL(this, "APIWebACL", {
      name: 'APIWebACL',
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "API_WAF",
        sampledRequestsEnabled: false,
      },
      rules: wafRules.map((wafRule) => wafRule.Rule),
    });

    new waf.CfnWebACLAssociation(this, "APIGatewayWebACLAssociation", {
      webAclArn: apiWebACL.attrArn,
      resourceArn: cdk.Fn.join("", ["arn:aws:apigateway:", this.region, "::/restapis/", api.deploymentStage.restApi.restApiId, "/stages/",api.deploymentStage.stageName ])
    });
    
    const cloudfrontDistribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: { 
        origin: new origins.S3Origin(spaBucket), 
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, //TODO
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        },
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
    });

    const wafIntegrationURL = new crGetWafIntegrationURL(this, 'customResource', {
          Id: apiWebACL.attrId,
          Name: apiWebACL.name || '',
          Scope: 'REGIONAL'
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.data('index.html', html.replace('URLPLACEHOLDER', wafIntegrationURL.applicationIntegrationURL))],
      destinationBucket: spaBucket,
    });

    new CfnOutput(this, 'S3 bucket', { value: spaBucket.bucketName });
    
    new CfnOutput(this, 'CloudFront URL', {
      value: `https://${cloudfrontDistribution.distributionDomainName}`
    });


  }
}