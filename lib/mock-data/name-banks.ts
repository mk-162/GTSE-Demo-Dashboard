// Realistic-looking company name parts for UK and US.
export const UK_TOWNS = [
  "Birmingham", "Manchester", "Sheffield", "Leeds", "Liverpool", "Newcastle", "Bristol",
  "Glasgow", "Edinburgh", "Cardiff", "Swansea", "Belfast", "Aberdeen", "Dundee", "Inverness",
  "Norwich", "Norfolk", "Suffolk", "Cambridge", "Oxford", "Reading", "Slough", "Luton",
  "Coventry", "Nottingham", "Derby", "Leicester", "Stoke", "Wolverhampton", "Walsall",
  "Sunderland", "Middlesbrough", "Hull", "Lincoln", "Doncaster", "Rotherham", "Barnsley",
  "York", "Harrogate", "Halifax", "Huddersfield", "Bradford", "Wakefield", "Dewsbury",
  "Preston", "Blackburn", "Burnley", "Bolton", "Wigan", "Warrington", "Chester", "Crewe",
  "Stockport", "Oldham", "Rochdale", "Salford", "Trafford", "Bury", "Tameside",
  "Plymouth", "Exeter", "Torquay", "Bath", "Bournemouth", "Poole", "Southampton",
  "Portsmouth", "Brighton", "Hastings", "Eastbourne", "Worthing", "Crawley", "Maidstone",
  "Canterbury", "Dover", "Margate", "Folkestone", "Tunbridge", "Guildford", "Woking",
  "Croydon", "Bromley", "Romford", "Ilford", "Watford", "Stevenage", "Harlow",
  "Chelmsford", "Colchester", "Ipswich", "Peterborough", "Bedford", "Northampton",
  "Milton Keynes", "Aylesbury", "Banbury", "Swindon", "Gloucester", "Cheltenham",
  "Hereford", "Worcester", "Telford", "Shrewsbury", "Stafford", "Burton", "Lichfield",
] as const;

export const US_CITIES = [
  "Houston", "Dallas", "Austin", "San Antonio", "Fort Worth",
  "Detroit", "Cleveland", "Cincinnati", "Columbus", "Indianapolis",
  "Chicago", "Milwaukee", "Madison", "Minneapolis", "St. Paul", "St. Louis",
  "Atlanta", "Charlotte", "Raleigh", "Nashville", "Memphis", "Birmingham AL",
  "Seattle", "Tacoma", "Spokane", "Portland", "Salem", "Boise",
  "Phoenix", "Tucson", "Mesa", "Scottsdale", "Albuquerque",
  "Denver", "Colorado Springs", "Boulder", "Salt Lake City",
  "Boston", "Worcester", "Providence", "Hartford", "New Haven",
  "Philadelphia", "Pittsburgh", "Harrisburg", "Allentown", "Wilmington",
  "Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale",
  "New Orleans", "Baton Rouge", "Mobile", "Jackson",
  "Kansas City", "Omaha", "Tulsa", "Oklahoma City", "Wichita",
  "Sacramento", "San Jose", "Fresno", "Bakersfield", "Long Beach",
  "Las Vegas", "Reno", "Henderson",
  "Buffalo", "Rochester", "Syracuse", "Albany",
  "Richmond", "Norfolk VA", "Virginia Beach", "Charleston",
  "Louisville", "Lexington", "Knoxville", "Chattanooga",
] as const;

export const UK_SECTORS = [
  "Engineering", "Manufacturing", "Industrial", "Steelworks", "Logistics", "Marine",
  "Construction", "Highway Maintenance", "Facilities", "Utilities", "Rail Services",
  "Petroleum", "Aerospace", "Automotive", "Pharmaceutical", "Food Processing",
  "Heavy Industries", "Light Industries", "Mechanical", "Electrical Contractors",
  "Civils", "Estates", "Shipping", "Refrigeration", "Plant Hire", "Scaffolding",
] as const;

export const US_SECTORS = [
  "Manufacturing", "Industrial Supply", "Highway Contractors", "Petroleum Services",
  "Aerospace Components", "Logistics", "Marine Engineering", "Utilities",
  "Construction", "Facilities", "Heavy Industries", "Steel Works", "Refining",
  "Pharmaceutical", "Food & Beverage", "Power Systems", "Rail Operators",
  "Mining Services", "Defense Contractors", "Plant Services", "Environmental",
] as const;

export const UK_SUFFIXES = ["Ltd", "Plc", "Group", "Services", "Solutions", "Co", "Ltd"] as const;
export const US_SUFFIXES = ["Inc", "LLC", "Corp", "Co", "Group", "Inc", "LLC"] as const;

export const UK_COUNTIES = [
  "Greater London", "West Midlands", "Greater Manchester", "Merseyside", "West Yorkshire",
  "South Yorkshire", "Tyne and Wear", "Strathclyde", "Lothian", "South Glamorgan",
  "Norfolk", "Suffolk", "Essex", "Kent", "Surrey", "Sussex", "Hampshire", "Devon",
  "Cornwall", "Somerset", "Wiltshire", "Gloucestershire", "Oxfordshire", "Berkshire",
  "Buckinghamshire", "Hertfordshire", "Cambridgeshire", "Bedfordshire", "Northamptonshire",
  "Warwickshire", "Worcestershire", "Staffordshire", "Shropshire", "Cheshire", "Lancashire",
  "Cumbria", "North Yorkshire", "Northumberland", "Durham", "Aberdeenshire", "Highland",
] as const;

export const US_STATES = [
  "TX", "CA", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI", "NJ", "VA", "WA", "AZ",
  "MA", "TN", "IN", "MO", "MD", "WI", "CO", "MN", "SC", "AL", "LA", "KY", "OR", "OK",
  "CT", "UT", "IA", "NV", "AR", "MS", "KS", "NM", "NE", "ID", "WV", "HI", "NH", "ME",
] as const;

export const UK_AE_NAMES = [
  "Sarah Whitcombe", "James Patterson", "Eleanor Hughes", "Tom Lawson",
  "Priya Shah", "Daniel Wright", "Charlotte Bennett", "Marcus Reid",
] as const;

export const US_AE_NAMES = [
  "Jenna Marsh", "Carlos Reyes", "Mike Donovan", "Ashley Park",
  "Brett Kowalski", "Tiffany Jones", "Jordan Mitchell",
] as const;

export const INDUSTRIES = [
  "Construction", "Manufacturing", "Engineering Services", "Logistics & Warehousing",
  "Facilities Management", "Highway Maintenance", "Rail", "Utilities", "Oil & Gas",
  "Mining", "Food Processing", "Pharmaceutical Manufacturing", "Automotive",
  "Aerospace", "Marine", "Public Sector / Local Authority", "Education (FE/HE)",
  "Healthcare Estates",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const NAMED_UK_WHALES = [
  { name: "Sheffield Steelworks", industry: "Manufacturing", region_subdiv: "South Yorkshire" },
  { name: "Birmingham Engineering Co Ltd", industry: "Engineering Services", region_subdiv: "West Midlands" },
  { name: "Manchester Manufacturing Group", industry: "Manufacturing", region_subdiv: "Greater Manchester" },
  { name: "Glasgow Industrial Solutions", industry: "Engineering Services", region_subdiv: "Strathclyde" },
  { name: "Newcastle Marine Services", industry: "Marine", region_subdiv: "Tyne and Wear" },
  { name: "Cardiff Construction Group", industry: "Construction", region_subdiv: "South Glamorgan" },
  { name: "Bristol Highway Maintenance", industry: "Highway Maintenance", region_subdiv: "Gloucestershire" },
  { name: "Leeds Logistics Ltd", industry: "Logistics & Warehousing", region_subdiv: "West Yorkshire" },
  { name: "Edinburgh Utilities Plc", industry: "Utilities", region_subdiv: "Lothian" },
  { name: "Norfolk Facilities Management", industry: "Facilities Management", region_subdiv: "Norfolk" },
] as const;

export const NAMED_US_WHALES = [
  { name: "Houston Petroleum Services", industry: "Oil & Gas", region_subdiv: "TX" },
  { name: "Detroit Manufacturing Inc", industry: "Manufacturing", region_subdiv: "MI" },
  { name: "Seattle Aerospace Components", industry: "Aerospace", region_subdiv: "WA" },
  { name: "Chicago Logistics Group", industry: "Logistics & Warehousing", region_subdiv: "IL" },
  { name: "Phoenix Highway Contractors", industry: "Highway Maintenance", region_subdiv: "AZ" },
  { name: "Atlanta Industrial Supply Co", industry: "Manufacturing", region_subdiv: "GA" },
  { name: "Boston Marine Engineering", industry: "Marine", region_subdiv: "MA" },
  { name: "Denver Utilities Corp", industry: "Utilities", region_subdiv: "CO" },
  { name: "Miami Facilities LLC", industry: "Facilities Management", region_subdiv: "FL" },
  { name: "Portland Construction Inc", industry: "Construction", region_subdiv: "OR" },
] as const;
