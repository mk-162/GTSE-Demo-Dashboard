// Real GTSE SKUs sampled from the BigCommerce Jan 2026 RRP price list.
// Item Numbers, descriptions, and prices are from the production catalogue.
// Bulk-pack equivalents (for large industrial accounts) are constructed by scaling.

export type Sku = {
  code: string;
  name: string;
  category: string;
  unitPrice: number;
};

export const SKUS: Sku[] = [
  // Warning Signs
  { code: "51692", name: "Biohazard symbol self-adhesive 25x25mm", category: "Warning Signs", unitPrice: 1.27 },
  { code: "24012E", name: "Danger electricity 200x150mm", category: "Warning Signs", unitPrice: 2.95 },
  { code: "24441G", name: "Warning misuse of compressed air 300x100mm", category: "Warning Signs", unitPrice: 3.20 },
  { code: "24221F", name: "Danger of death symbol 200x200mm", category: "Warning Signs", unitPrice: 3.41 },
  { code: "14075G", name: "Danger Unsafe structure 300x100mm", category: "Warning Signs", unitPrice: 3.85 },
  { code: "14250G", name: "Warning stand clear of suspended loads 300x100mm", category: "Warning Signs", unitPrice: 3.85 },
  { code: "54051", name: "Danger 400 volts label sheet of 25 40x50mm", category: "Warning Signs", unitPrice: 7.19 },
  { code: "24332M", name: "Warning forklift charging area 600x200mm", category: "Warning Signs", unitPrice: 9.00 },
  { code: "55064", name: "Exclamation mark double-sided safety tags pack of 10 80x150mm", category: "Warning Signs", unitPrice: 12.61 },
  { code: "14020M", name: "Danger buried cable 600x200mm", category: "Warning Signs", unitPrice: 13.20 },
  { code: "14280K", name: "Warning sudden drop ISO 20712 400x300mm", category: "Warning Signs", unitPrice: 14.59 },
  { code: "14479P", name: "Danger explosive atmosphere 600x400mm", category: "Warning Signs", unitPrice: 22.93 },

  // Fire Signs
  { code: "21203A", name: "Fire Extinguisher Maintenance Label 75x100mm", category: "Fire Signs", unitPrice: 1.37 },
  { code: "21635U", name: "Fire door keep locked 100x100mm", category: "Fire Signs", unitPrice: 2.22 },
  { code: "21063E", name: "Nearest fire marshal name plate 200x150mm", category: "Fire Signs", unitPrice: 2.95 },
  { code: "21110F", name: "PIB Fire and Rescue Service use only 200x200mm", category: "Fire Signs", unitPrice: 3.41 },
  { code: "11242S", name: "L2 powder extinguisher identification 75x200mm", category: "Fire Signs", unitPrice: 4.31 },
  { code: "11202E", name: "AVD lithium battery extinguisher identification 200x150mm", category: "Fire Signs", unitPrice: 6.24 },
  { code: "11429E", name: "Fire action brigade dialled automatically without lift 200x150mm", category: "Fire Signs", unitPrice: 6.24 },
  { code: "11408Y", name: "Fire action auto dial with lift 200x300mm", category: "Fire Signs", unitPrice: 7.55 },
  { code: "41079E", name: "In event of fire lift cover and activate alarm 200x150mm", category: "Fire Signs", unitPrice: 10.63 },
  { code: "11009K", name: "Fire extinguisher keep clear 400x300mm", category: "Fire Signs", unitPrice: 14.59 },

  // Photoluminescent
  { code: "41017U", name: "Fire alarm call point symbol photoluminescent 100x100mm", category: "Photoluminescent", unitPrice: 3.13 },
  { code: "32038C", name: "Arrow 180 degree photoluminescent 150x150mm", category: "Photoluminescent", unitPrice: 5.05 },
  { code: "41428E", name: "Fire action brigade dialled with lift photoluminescent 200x150mm", category: "Photoluminescent", unitPrice: 10.63 },
  { code: "31010E", name: "Fire alarm photoluminescent 200x150mm", category: "Photoluminescent", unitPrice: 12.38 },
  { code: "42062L", name: "Fire exit keep clear photoluminescent 450x150mm", category: "Photoluminescent", unitPrice: 16.70 },
  { code: "32090L", name: "Fire exit arrow down right HTM 450x150mm", category: "Photoluminescent", unitPrice: 21.65 },

  // Mandatory Signs
  { code: "55040", name: "Switch off when not in use SAV 35x25mm", category: "Mandatory Signs", unitPrice: 1.27 },
  { code: "25464G", name: "Overshoes must be worn 300x100mm", category: "Mandatory Signs", unitPrice: 3.20 },
  { code: "25409F", name: "Wash hands symbol 200x200mm", category: "Mandatory Signs", unitPrice: 3.41 },
  { code: "15487G", name: "Please flush the toilet after use 300x100mm", category: "Mandatory Signs", unitPrice: 3.85 },
  { code: "28937H", name: "Access by appointment only 300x250mm", category: "Mandatory Signs", unitPrice: 6.89 },
  { code: "25504M", name: "Tool tethers must be used above 2m 600x200mm", category: "Mandatory Signs", unitPrice: 9.00 },
  { code: "15003M", name: "Eye protection must be worn 600x200mm", category: "Mandatory Signs", unitPrice: 13.20 },
  { code: "13022K", name: "Life jackets must be worn 400x300mm", category: "Mandatory Signs", unitPrice: 14.59 },

  // Prohibition Signs
  { code: "53431", name: "Computer do not switch off SAV 35x25mm", category: "Prohibition Signs", unitPrice: 1.27 },
  { code: "23089G", name: "Smoking permitted in this area 300x100mm", category: "Prohibition Signs", unitPrice: 3.20 },
  { code: "23604F", name: "Not drinking water symbol 200x200mm", category: "Prohibition Signs", unitPrice: 3.41 },
  { code: "13207G", name: "No pedestrians 300x100mm", category: "Prohibition Signs", unitPrice: 3.85 },
  { code: "15496E", name: "No dogs except guide dogs 200x150mm", category: "Prohibition Signs", unitPrice: 6.24 },
  { code: "21772K", name: "Please do not feed the gulls 400x300mm", category: "Prohibition Signs", unitPrice: 9.07 },
  { code: "13410M", name: "Do not operate 600x200mm", category: "Prohibition Signs", unitPrice: 13.20 },
  { code: "13614K", name: "No diving 400x300mm", category: "Prohibition Signs", unitPrice: 14.59 },

  // Exit Signs
  { code: "22067A", name: "Press to exit 75x100mm", category: "Exit Signs", unitPrice: 1.37 },
  { code: "12087G", name: "Disabled fire exit arrow left 300x100mm", category: "Exit Signs", unitPrice: 3.85 },
  { code: "12010L", name: "Exit arrow up right 450x150mm", category: "Exit Signs", unitPrice: 9.91 },

  // Road Signs
  { code: "17684G", name: "Private no through road 300x100mm", category: "Road Signs", unitPrice: 3.85 },
  { code: "17549N", name: "Straight ahead only 400x400mm", category: "Road Signs", unitPrice: 19.44 },
  { code: "67508K", name: "One way arrow right 400x300mm", category: "Road Signs", unitPrice: 26.30 },
  { code: "17520Q", name: "Concealed entrance 600x450mm", category: "Road Signs", unitPrice: 27.06 },
  { code: "57664", name: "Thermoplastic reflective traffic cone with sleeve 750mm", category: "Road Signs", unitPrice: 39.47 },
  { code: "57742", name: "Pedal cycle route only class R2 300mm dia", category: "Road Signs", unitPrice: 55.28 },
  { code: "57907", name: "Road closed 1050x750mm Class RA1 zintec", category: "Road Signs", unitPrice: 62.62 },
  { code: "57819", name: "Vehicle priority class RA1 600mm dia channelling", category: "Road Signs", unitPrice: 89.31 },

  // Multi-Message Signs
  { code: "56487", name: "Petrol self-adhesive 25x25mm", category: "Multi-Message Signs", unitPrice: 1.27 },
  { code: "14559G", name: "Danger hot works in progress no entry 300x100mm", category: "Multi-Message Signs", unitPrice: 3.85 },
  { code: "24562M", name: "Danger flammable storage no hot works 600x200mm", category: "Multi-Message Signs", unitPrice: 9.00 },
  { code: "16223M", name: "Warning dangerous site keep out 600x200mm", category: "Multi-Message Signs", unitPrice: 13.20 },
  { code: "16232P", name: "Warning fragile roof not for storage 600x400mm", category: "Multi-Message Signs", unitPrice: 22.93 },

  // Information Signs
  { code: "27028A", name: "Push 75x100mm", category: "Information Signs", unitPrice: 1.37 },
  { code: "27024F", name: "Ladies symbol 200x200mm", category: "Information Signs", unitPrice: 3.41 },
  { code: "27112Y", name: "Warning abusive language not tolerated 200x300mm", category: "Information Signs", unitPrice: 4.90 },
  { code: "17106Y", name: "Car park vehicles left at owner's risk 200x300mm", category: "Information Signs", unitPrice: 7.55 },

  // Construction Signs
  { code: "26459G", name: "Warning beware of moving vehicles 300x100mm", category: "Construction Signs", unitPrice: 3.20 },
  { code: "55737", name: "Exit arrow right builder sign 400x400mm", category: "Construction Signs", unitPrice: 9.50 },
  { code: "16439K", name: "A tidy area is a safer area 400x300mm", category: "Construction Signs", unitPrice: 14.59 },
  { code: "53737", name: "Courtesy sign drywipe sections zintec 600x450mm", category: "Construction Signs", unitPrice: 39.40 },
  { code: "56392", name: "Site Starter Pack 3 — pack of 7 signs", category: "Construction Signs", unitPrice: 75.98 },

  // Janitorial & Environmental
  { code: "26617A", name: "Paper recycling 75x100mm", category: "Janitorial & Environmental", unitPrice: 1.37 },
  { code: "26663G", name: "Fluorescent tubes WRAP recycling 300x100mm", category: "Janitorial & Environmental", unitPrice: 3.20 },
  { code: "16619Y", name: "Cardboard recycling 200x300mm", category: "Janitorial & Environmental", unitPrice: 7.55 },
  { code: "16644M", name: "Food waste WRAP recycling 600x200mm", category: "Janitorial & Environmental", unitPrice: 13.20 },

  // First Aid & Safe Condition
  { code: "51100", name: "Tamper proof tag 300mm length", category: "First Aid & Safe Condition Signs", unitPrice: 1.07 },
  { code: "15996S", name: "Directional indicator for first aid equipment 75x200mm", category: "First Aid & Safe Condition Signs", unitPrice: 4.31 },
  { code: "25990H", name: "AED sign with instructions RCUK 300x250mm", category: "First Aid & Safe Condition Signs", unitPrice: 6.89 },
  { code: "16018Y", name: "First aid available from 200x300mm", category: "First Aid & Safe Condition Signs", unitPrice: 7.55 },
  { code: "16004H", name: "Your first aiders are 300x250mm", category: "First Aid & Safe Condition Signs", unitPrice: 11.56 },

  // Floor Graphics
  { code: "58615", name: "Black/Yellow floor graphic strip 1000x50mm", category: "Floor Graphics", unitPrice: 9.65 },
  { code: "58788", name: "Stop give way floor graphic 400mm dia", category: "Floor Graphics", unitPrice: 25.82 },
  { code: "58909", name: "Caution pedestrian area floor graphic 600x400mm", category: "Floor Graphics", unitPrice: 33.41 },
  { code: "53546", name: "Pedestrian symbol floor graphic external 400mm dia", category: "Floor Graphics", unitPrice: 39.25 },

  // Hazard Signs
  { code: "24542U", name: "Explosive GHS label 100x100mm", category: "Hazard Signs", unitPrice: 2.22 },
  { code: "24557U", name: "LQ diamond ADR 2011 100x100mm", category: "Hazard Signs", unitPrice: 2.22 },
  { code: "24516F", name: "Compressed gas 2 200x200mm", category: "Hazard Signs", unitPrice: 3.41 },
  { code: "54517", name: "100 S/A labels non-flammable gas 100x100mm", category: "Hazard Signs", unitPrice: 36.49 },

  // Security Signs
  { code: "21706U", name: "This door is alarmed 100x100mm", category: "Security Signs", unitPrice: 2.22 },
  { code: "11713Y", name: "CCTV images being monitored 200x300mm", category: "Security Signs", unitPrice: 7.55 },
  { code: "21748P", name: "CCTV images recorded and monitored 600x400mm", category: "Security Signs", unitPrice: 14.49 },

  // Vehicle Marking
  { code: "21817U", name: "Limited to 30mph 100x100mm", category: "Vehicle Marking Signs", unitPrice: 2.22 },
  { code: "56348", name: "ECE70 vehicle marking plate aluminium 600x200mm", category: "Vehicle Marking Signs", unitPrice: 27.13 },

  // 5S/6S
  { code: "55958", name: "Plastic hook for hanging rail 55x70mm", category: "5S/6S", unitPrice: 3.25 },
  { code: "15945K", name: "6S steps to safety keep all areas tidy 400x300mm", category: "5S/6S", unitPrice: 14.59 },
  { code: "55951", name: "Keep all areas clean and tidy 6S Poster 400x600mm", category: "5S/6S", unitPrice: 27.91 },

  // Floor Safety
  { code: "59018", name: "Attachment nylon S-hook for chains red", category: "Floor Safety", unitPrice: 2.93 },
  { code: "59612", name: "PVC stencil no entry 600x400mm", category: "Floor Safety", unitPrice: 27.78 },
  { code: "59643", name: "PVC stencil letters A-Z 300mm", category: "Floor Safety", unitPrice: 84.84 },

  // Warehouse Labelling and Marking
  { code: "27185E", name: "Inspect forklifts before use SAV label 200x150mm", category: "Warehouse Labelling and Marking", unitPrice: 2.95 },
  { code: "17187H", name: "Inspect pallet trucks before use PVC sign 300x250mm", category: "Warehouse Labelling and Marking", unitPrice: 11.56 },
  { code: "59965", name: "Flow marker pack of 5 oil 300x40mm SAV", category: "Warehouse Labelling and Marking", unitPrice: 15.25 },
  { code: "59841", name: "Identification letter sets A-Z 38x90mm (26 pack)", category: "Warehouse Labelling and Marking", unitPrice: 25.52 },

  // Bulk packs (constructed) — used by large industrial accounts ordering case quantities.
  { code: "BULK-FIRESIGN-50", name: "Fire signs assorted bulk pack of 50 (mixed sizes)", category: "Bulk Packs", unitPrice: 285.00 },
  { code: "BULK-WARNING-50", name: "Warning signs assorted bulk pack of 50 (mixed sizes)", category: "Bulk Packs", unitPrice: 295.00 },
  { code: "BULK-MANDATORY-50", name: "Mandatory signs bulk pack of 50 (mixed sizes)", category: "Bulk Packs", unitPrice: 245.00 },
  { code: "BULK-SITE-100", name: "Construction site bulk pack of 100 signs", category: "Bulk Packs", unitPrice: 565.00 },
  { code: "BULK-FLOOR-100M", name: "Floor marking strip bulk roll 100m black/yellow", category: "Bulk Packs", unitPrice: 425.00 },
  { code: "BULK-EXIT-LED-25", name: "LED exit signs case of 25 photoluminescent", category: "Bulk Packs", unitPrice: 1245.00 },
];

export const SKU_BY_CODE: Record<string, Sku> = Object.fromEntries(SKUS.map((s) => [s.code, s]));
