# 🚀 VPC Peering Pulumi Project

A simple Pulumi program to establish a cross-account VPC peering connection between two AWS accounts.

---

## 📋 Overview

This project automates:

- 🔗 **VPC Peering Connection**  
  Creates a peering request in the “requester” account and automatically accepts it in the “accepter” account.

- 🌐 **Route Configuration**  
  Looks up each account’s main route table and adds bidirectional routes over the peering link.

- 🔧 **Multi-Account Providers**  
  Uses distinct Pulumi AWS providers (with CLI profiles) for each account.

---

## 🛠️ Prerequisites

- Node.js ≥14  
- Pulumi CLI ≥3.x  
- AWS CLI configured with two named profiles:
  - `requester`
  - `accepter`

- Two existing Pulumi stacks exporting:
  - `vpcId` for the requester VPC
  - `vpcId` for the accepter VPC

