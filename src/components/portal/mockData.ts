export const agents = [
  { name: "Justin Brewer", email: "justin@greenhubinc.com", role: "Admin", status: "Active", commission: "0%" },
  { name: "Nicholas Sanchez", email: "nick@greenhubinc.com", role: "Agent", status: "Active", commission: "20%" },
  { name: "Rob Sinn", email: "rob@paynex.net", role: "Agent", status: "Active", commission: "18%" },
  { name: "Mark Suchy", email: "mark@greenhubinc.com", role: "Agent", status: "Active", commission: "15%" },
];

export const accounts = [
  {
    merchant: "Prime Wellness",
    platform: "ElitePay – Adyen",
    status: "Active",
    agent: "Nicholas Sanchez",
    volume: "$82,400",
    residual: "$1,248",
    netProfit: "$2,840",
    equipment: "$180",
  },
  {
    merchant: "Oakline Retail",
    platform: "Linked2Pay – Avidia",
    status: "Active",
    agent: "Rob Sinn",
    volume: "$54,100",
    residual: "$842",
    netProfit: "$1,940",
    equipment: "$0",
  },
  {
    merchant: "Harbor Med Spa",
    platform: "Paybotx – Fiserv",
    status: "Paused",
    agent: "Mark Suchy",
    volume: "$31,900",
    residual: "$420",
    netProfit: "$1,120",
    equipment: "$95",
  },
];

export const agentResiduals = [
  {
    merchant: "Prime Wellness",
    platform: "ElitePay – Adyen",
    month: "June 2026",
    status: "Finalized",
    volume: "$82,400",
    residual: "$1,248",
    netProfit: "$2,840",
    equipment: "$180",
  },
  {
    merchant: "Oakline Retail",
    platform: "Linked2Pay – Avidia",
    month: "June 2026",
    status: "Finalized",
    volume: "$54,100",
    residual: "$842",
    netProfit: "$1,940",
    equipment: "$0",
  },
  {
    merchant: "Harbor Med Spa",
    platform: "Paybotx – Fiserv",
    month: "June 2026",
    status: "Finalized",
    volume: "$31,900",
    residual: "$420",
    netProfit: "$1,120",
    equipment: "$95",
  },
];

export const platforms = [
  "Best Rate",
  "Best Rate – Nuvei",
  "ElitePay",
  "ElitePay – Adyen",
  "Linked2Pay",
  "Linked2Pay – Avidia",
  "Paybotx",
  "Paybotx – Fiserv",
  "Paynex",
  "Valmar",
];
