import * as pulumi from "@pulumi/pulumi";
import * as aws    from "@pulumi/aws";

// Config namespaces
const awsCfg = new pulumi.Config("aws");
const reqCfg = new pulumi.Config("requester");
const accCfg = new pulumi.Config("accepter");

const region = awsCfg.require("region") as aws.Region;

// Providers for each account
const requester = new aws.Provider("requester", {
  profile: reqCfg.require("profile"),
  region:  region,
});

const accepter = new aws.Provider("accepter", {
  profile: accCfg.require("profile"),
  region:  region,
});

// StackRefs for the existing VPC stacks
const reqRef = new pulumi.StackReference(reqCfg.require("stackRef"));
const accRef = new pulumi.StackReference(accCfg.require("stackRef"));

const reqVpcId = reqRef.getOutput("vpcId");
const accVpcId = accRef.getOutput("vpcId");

// Look up the CIDRs
const reqVpc = aws.ec2.getVpcOutput({ id: reqVpcId }, { provider: requester });
const accVpc = aws.ec2.getVpcOutput({ id: accVpcId }, { provider: accepter });

// 1) Create peering request in requester account
const peer = new aws.ec2.VpcPeeringConnection("peer-req-to-acc", {
  vpcId       : reqVpcId,
  peerVpcId   : accVpcId,
  peerOwnerId : accCfg.require("accountId"),
  tags: { Name: "requester↔accepter" },
}, { provider: requester });

// 2) Accept in accepter account
new aws.ec2.VpcPeeringConnectionAccepter("peer-acc-accept", {
  vpcPeeringConnectionId: peer.id,
  autoAccept            : true,
}, { provider: accepter });

// 3) Get configured route table IDs from config
const reqRouteTableIds = reqCfg.requireObject<string[]>("routeTableIds");
const accRouteTableIds = accCfg.requireObject<string[]>("routeTableIds");

// 4) Create routes in specified requester route tables pointing to accepter VPC
reqRouteTableIds.forEach((rtId, index) => {
  new aws.ec2.Route(`route-req-to-acc-${index}`, {
    routeTableId          : rtId,
    destinationCidrBlock  : accVpc.cidrBlock,
    vpcPeeringConnectionId: peer.id,
  }, { provider: requester });
});

// 5) Create routes in specified accepter route tables pointing to requester VPC
accRouteTableIds.forEach((rtId, index) => {
  new aws.ec2.Route(`route-acc-to-req-${index}`, {
    routeTableId          : rtId,
    destinationCidrBlock  : reqVpc.cidrBlock,
    vpcPeeringConnectionId: peer.id,
  }, { provider: accepter });
});

// Export the peering ID and route table info
export const vpcPeeringId = peer.id;
export const requesterRouteTableCount = reqRouteTableIds.length;
export const accepterRouteTableCount = accRouteTableIds.length;
export const configuredRequesterRouteTables = reqRouteTableIds;
export const configuredAccepterRouteTables = accRouteTableIds;