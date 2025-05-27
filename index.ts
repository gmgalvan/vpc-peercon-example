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

// Look up the CIDRs (unchanged)
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

// 3) Fetch each main route table via filter
const reqRts = aws.ec2.getRouteTablesOutput({
  vpcId:    reqVpcId,
  filters: [{ name: "association.main", values: ["true"] }],
}, { provider: requester });

const accRts = aws.ec2.getRouteTablesOutput({
  vpcId:    accVpcId,
  filters: [{ name: "association.main", values: ["true"] }],
}, { provider: accepter });

// Extract the single route table IDs
const reqRtId = reqRts.ids.apply(ids => ids[0]);
const accRtId = accRts.ids.apply(ids => ids[0]);

// 4) Create routes pointing across the peering in each account
new aws.ec2.Route("route-req-to-acc", {
  routeTableId          : reqRtId,
  destinationCidrBlock  : accVpc.cidrBlock,
  vpcPeeringConnectionId: peer.id,
}, { provider: requester });

new aws.ec2.Route("route-acc-to-req", {
  routeTableId          : accRtId,
  destinationCidrBlock  : reqVpc.cidrBlock,
  vpcPeeringConnectionId: peer.id,
}, { provider: accepter });

// Export the peering ID
export const vpcPeeringId = peer.id;
