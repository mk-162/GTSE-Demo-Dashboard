export type Sku = {
  code: string;
  name: string;
  category: string;
  unitPrice: number;
};

export const SKUS: Sku[] = [
  // Safety signs
  { code: "SS-A4-DANG-001", name: "A4 Danger Sign — laminated", category: "Safety Signs", unitPrice: 6.5 },
  { code: "SS-A4-CAUT-002", name: "A4 Caution Sign — rigid plastic", category: "Safety Signs", unitPrice: 6.95 },
  { code: "SS-A3-PROH-001", name: "A3 Prohibition Sign — aluminium", category: "Safety Signs", unitPrice: 14.5 },
  { code: "SS-A3-WARN-002", name: "A3 Warning Triangle Sign", category: "Safety Signs", unitPrice: 14.95 },
  { code: "SS-A5-MAND-001", name: "A5 Mandatory Sign Pack (10)", category: "Safety Signs", unitPrice: 28.0 },
  { code: "SIGN-EXIT-LED-200", name: "LED Emergency Exit Sign 200mm", category: "Safety Signs", unitPrice: 64.0 },
  { code: "SIGN-FIRE-EXT-001", name: "Fire Extinguisher Location Sign", category: "Safety Signs", unitPrice: 5.5 },
  { code: "SIGN-FIRST-AID-001", name: "First Aid Point Sign — luminous", category: "Safety Signs", unitPrice: 8.95 },
  { code: "SIGN-NO-SMOKE-A5", name: "No Smoking Sign A5 (pack of 5)", category: "Safety Signs", unitPrice: 12.5 },
  { code: "SIGN-CONST-SET-100", name: "Construction Site Sign Pack (100)", category: "Safety Signs", unitPrice: 295.0 },

  // Industrial markers / tape
  { code: "RT-IND-MARK-RED-50M", name: "Industrial Floor Marker Red 50m", category: "Floor Marking", unitPrice: 38.0 },
  { code: "RT-IND-MARK-YEL-50M", name: "Industrial Floor Marker Yellow 50m", category: "Floor Marking", unitPrice: 38.0 },
  { code: "RT-IND-MARK-BLK-50M", name: "Industrial Floor Marker Black/Yellow 50m", category: "Floor Marking", unitPrice: 42.0 },
  { code: "RT-IND-MARK-GRN-50M", name: "Industrial Floor Marker Green 50m", category: "Floor Marking", unitPrice: 38.0 },
  { code: "TAPE-BARR-RED-500", name: "Barrier Tape Red/White 500m", category: "Floor Marking", unitPrice: 22.5 },
  { code: "TAPE-BARR-YEL-500", name: "Barrier Tape Yellow/Black 500m", category: "Floor Marking", unitPrice: 22.5 },
  { code: "TAPE-AISLE-WHT-50M", name: "Aisle Marking Tape White 50m", category: "Floor Marking", unitPrice: 32.0 },
  { code: "FLOOR-EPOXY-25L", name: "Epoxy Floor Paint 25L Grey", category: "Floor Marking", unitPrice: 165.0 },
  { code: "FLOOR-EPOXY-CLEAR-10L", name: "Clear Epoxy Floor Sealer 10L", category: "Floor Marking", unitPrice: 89.0 },
  { code: "FLOOR-LINE-KIT-PRO", name: "Floor Line Marking Kit Pro", category: "Floor Marking", unitPrice: 245.0 },

  // PPE
  { code: "PPE-HV-VEST-XL", name: "Hi-Vis Vest XL (pack of 10)", category: "PPE", unitPrice: 45.0 },
  { code: "PPE-HV-VEST-L", name: "Hi-Vis Vest L (pack of 10)", category: "PPE", unitPrice: 45.0 },
  { code: "PPE-HV-JKT-XL", name: "Hi-Vis Waterproof Jacket XL", category: "PPE", unitPrice: 38.5 },
  { code: "PPE-GLOVE-NIT-100", name: "Nitrile Gloves Box of 100", category: "PPE", unitPrice: 18.5 },
  { code: "PPE-GLOVE-CUT-XL", name: "Cut-Resistant Gloves XL (pair)", category: "PPE", unitPrice: 9.5 },
  { code: "PPE-HARDHAT-WHT", name: "Hard Hat White (case of 10)", category: "PPE", unitPrice: 89.0 },
  { code: "PPE-HARDHAT-YEL", name: "Hard Hat Yellow (case of 10)", category: "PPE", unitPrice: 89.0 },
  { code: "PPE-GOGGLE-SAFE", name: "Safety Goggles Anti-Fog (pack 12)", category: "PPE", unitPrice: 32.0 },
  { code: "PPE-EAR-MUFF-30dB", name: "Ear Defenders 30dB", category: "PPE", unitPrice: 24.0 },
  { code: "PPE-DUST-MASK-50", name: "FFP3 Dust Masks Box of 50", category: "PPE", unitPrice: 42.5 },
  { code: "PPE-BOOT-S3-10", name: "Safety Boots S3 Size 10 (pair)", category: "PPE", unitPrice: 58.0 },
  { code: "PPE-OVERALL-XL", name: "Disposable Overalls XL (pack 25)", category: "PPE", unitPrice: 75.0 },

  // Access / ladders
  { code: "LADDER-EXT-3M-ALU", name: "Extension Ladder 3m Aluminium", category: "Access", unitPrice: 145.0 },
  { code: "LADDER-EXT-5M-ALU", name: "Extension Ladder 5m Aluminium", category: "Access", unitPrice: 215.0 },
  { code: "LADDER-STEP-6T-ALU", name: "Step Ladder 6 Tread Aluminium", category: "Access", unitPrice: 78.0 },
  { code: "LADDER-PLAT-2M", name: "Work Platform 2m", category: "Access", unitPrice: 320.0 },
  { code: "SCAFF-TOWER-3M", name: "Scaffold Tower 3m", category: "Access", unitPrice: 845.0 },

  // Spill control
  { code: "SPILL-KIT-OIL-240", name: "Oil Spill Kit 240L", category: "Spill Control", unitPrice: 195.0 },
  { code: "SPILL-KIT-CHEM-120", name: "Chemical Spill Kit 120L", category: "Spill Control", unitPrice: 165.0 },
  { code: "SPILL-PAD-OIL-100", name: "Oil Absorbent Pads (100)", category: "Spill Control", unitPrice: 48.0 },
  { code: "SPILL-GRAN-20KG", name: "Spill Granules 20kg", category: "Spill Control", unitPrice: 32.0 },
  { code: "SPILL-DRAIN-MAT-1M", name: "Drain Cover Mat 1m", category: "Spill Control", unitPrice: 85.0 },

  // Workplace consumables
  { code: "BIN-RECYC-240L", name: "Recycling Bin 240L", category: "Workplace", unitPrice: 98.0 },
  { code: "BIN-WHEELIE-1100L", name: "Wheelie Bin 1100L", category: "Workplace", unitPrice: 285.0 },
  { code: "MAT-ENT-LOGO-12X8", name: "Entrance Mat Logo 1200x800", category: "Workplace", unitPrice: 145.0 },
  { code: "MAT-ANTIFAT-9X6", name: "Anti-Fatigue Mat 900x600", category: "Workplace", unitPrice: 65.0 },
  { code: "TROLLEY-PLAT-500KG", name: "Platform Trolley 500kg", category: "Workplace", unitPrice: 195.0 },
  { code: "CABINET-COSHH-LRG", name: "COSHH Cabinet Large", category: "Workplace", unitPrice: 425.0 },

  // Lockout/tagout
  { code: "LOTO-PADLOCK-RED-6", name: "LOTO Padlock Red (pack 6)", category: "Lockout/Tagout", unitPrice: 78.0 },
  { code: "LOTO-STATION-12", name: "LOTO Station 12 Lock", category: "Lockout/Tagout", unitPrice: 215.0 },
  { code: "LOTO-TAG-PACK-50", name: "LOTO Tags (pack of 50)", category: "Lockout/Tagout", unitPrice: 24.0 },

  // Cleaning
  { code: "CLEAN-DEG-25L", name: "Industrial Degreaser 25L", category: "Cleaning", unitPrice: 58.0 },
  { code: "CLEAN-DISI-5L", name: "Disinfectant Concentrate 5L", category: "Cleaning", unitPrice: 32.0 },
  { code: "CLEAN-MOP-IND-10", name: "Industrial Mop Heads (pack 10)", category: "Cleaning", unitPrice: 38.0 },
  { code: "CLEAN-WIPES-IND-150", name: "Industrial Wipes (pack 150)", category: "Cleaning", unitPrice: 28.5 },

  // First aid
  { code: "FA-KIT-50P-BSI", name: "First Aid Kit 50 person BSI", category: "First Aid", unitPrice: 78.0 },
  { code: "FA-KIT-25P-BSI", name: "First Aid Kit 25 person BSI", category: "First Aid", unitPrice: 48.0 },
  { code: "FA-EYE-WASH-500", name: "Eye Wash Station 500ml", category: "First Aid", unitPrice: 38.5 },
  { code: "FA-DEFIB-AED-PRO", name: "AED Defibrillator Pro", category: "First Aid", unitPrice: 1245.0 },
  { code: "FA-BURN-KIT-PRO", name: "Burn Treatment Kit Pro", category: "First Aid", unitPrice: 56.0 },

  // Traffic / road
  { code: "ROAD-CONE-750-50", name: "Traffic Cone 750mm (50 pack)", category: "Traffic", unitPrice: 245.0 },
  { code: "ROAD-CONE-450-50", name: "Traffic Cone 450mm (50 pack)", category: "Traffic", unitPrice: 165.0 },
  { code: "ROAD-BARRIER-PLAS", name: "Plastic Road Barrier", category: "Traffic", unitPrice: 145.0 },
  { code: "ROAD-SIGN-STOP-600", name: "Stop Sign 600mm", category: "Traffic", unitPrice: 42.0 },
  { code: "ROAD-SIGN-DIVERT", name: "Diversion Sign Set", category: "Traffic", unitPrice: 185.0 },

  // Storage / shelving
  { code: "SHELF-STEEL-180", name: "Steel Shelving 1800mm 5-tier", category: "Storage", unitPrice: 125.0 },
  { code: "RACK-PALLET-3T", name: "Pallet Racking 3 Tier", category: "Storage", unitPrice: 485.0 },
  { code: "BIN-STORAGE-SM-100", name: "Storage Bins Small (100)", category: "Storage", unitPrice: 95.0 },

  // Electrical / safety equipment
  { code: "ELEC-RCD-ADAPT-13", name: "RCD Adapter 13A", category: "Electrical Safety", unitPrice: 28.5 },
  { code: "ELEC-EXT-LEAD-25M", name: "Heavy Duty Extension Lead 25m", category: "Electrical Safety", unitPrice: 65.0 },
  { code: "ELEC-CABLE-PROT-3M", name: "Cable Protector 3m", category: "Electrical Safety", unitPrice: 78.0 },

  // Misc industrial
  { code: "MARKER-PERM-IND-12", name: "Permanent Industrial Markers (12)", category: "Industrial Markers", unitPrice: 18.5 },
  { code: "MARKER-PAINT-RED-12", name: "Paint Markers Red (12)", category: "Industrial Markers", unitPrice: 24.0 },
  { code: "MARKER-CRAYON-IND-12", name: "Industrial Crayons (12)", category: "Industrial Markers", unitPrice: 14.5 },
  { code: "PADLOCK-IND-50MM-6", name: "Industrial Padlock 50mm (6)", category: "Security", unitPrice: 48.0 },
  { code: "CCTV-DOME-1080-4", name: "CCTV Dome 1080p (4 pack)", category: "Security", unitPrice: 285.0 },
  { code: "MIRROR-CONVEX-600", name: "Convex Mirror 600mm", category: "Security", unitPrice: 48.0 },
  { code: "BANNER-SAFE-1ST", name: "Safety First Banner 3m", category: "Workplace", unitPrice: 58.0 },
  { code: "STRAP-RATCHET-5M-4", name: "Ratchet Straps 5m (4 pack)", category: "Workplace", unitPrice: 38.0 },
];

export const SKU_BY_CODE: Record<string, Sku> = Object.fromEntries(SKUS.map((s) => [s.code, s]));
