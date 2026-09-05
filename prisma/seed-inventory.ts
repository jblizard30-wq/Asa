import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const inventoryTypes = [
  {
    slug: 'weekly-consumables',
    name: 'Weekly Consumables & Hospitality',
    description: 'Coffee, snacks, kitchen paper goods, beverages across all common spaces.',
    trackingMode: 'par_level',
    cadence: 'weekly',
    icon: 'Coffee',
  },
  {
    slug: 'liturgical-worship',
    name: 'Liturgical & Worship Supplies',
    description: 'Communion elements, connection cards, offering envelopes, and worship accessories.',
    trackingMode: 'par_level',
    cadence: 'biweekly',
    icon: 'Sparkles',
  },
  {
    slug: 'office-print',
    name: 'Office & Print Production',
    description: 'Copier toners, copy paper, cardstock, pens, and administrative supplies.',
    trackingMode: 'par_level',
    cadence: 'monthly',
    icon: 'Printer',
  },
  {
    slug: 'kids-nursery',
    name: 'Kids Ministry & Nursing Room',
    description: 'Baby wipes, nursery snacks, diapers, and childcare essentials.',
    trackingMode: 'par_level',
    cadence: 'weekly',
    icon: 'Baby',
  },
  {
    slug: 'facilities-janitorial',
    name: 'Facilities & Janitorial',
    description: 'Restroom paper products, foaming cleaners, soaps, and trash liners.',
    trackingMode: 'par_level',
    cadence: 'weekly',
    icon: 'ShieldCheck',
  },
];

const vendors = [
  {
    name: "Sam's Club",
    contactPerson: null,
    phone: null,
    email: null,
    url: 'https://www.samsclub.com',
    notes: 'Bulk wholesale club for kitchen, snacks, and general consumables',
  },
  {
    name: 'Amazon',
    contactPerson: null,
    phone: null,
    email: null,
    url: 'https://www.amazon.com',
    notes: 'Online ordering for stirrers, plates, pens, and paper',
  },
  {
    name: 'The Bean Doctor',
    contactPerson: 'Chris Hanson',
    phone: '636-399-6115',
    email: 'cwhanson@thebeandoctor.com',
    url: null,
    notes: 'Espresso and coffee machine maintenance & cleaning supplies',
  },
  {
    name: 'All Type Vacuum',
    contactPerson: 'Paul Unger',
    phone: null,
    email: 'paul@all-typevacuum.com',
    url: null,
    notes: 'Commercial janitorial chemicals, trash liners, and commercial paper towels',
  },
  {
    name: 'Bath & Body Works',
    contactPerson: null,
    phone: null,
    email: null,
    url: 'https://www.bathandbodyworks.com',
    notes: 'Foaming hand soaps for main bathrooms',
  },
  {
    name: 'Cece',
    contactPerson: 'Cece (Staff Shopper)',
    phone: null,
    email: null,
    url: null,
    notes: "Staff volunteer for local grocery runs (Trader Joe's, Fresh Milk, Juice)",
  },
  {
    name: 'Communion Cups Direct',
    contactPerson: null,
    phone: null,
    email: null,
    url: 'https://communioncups.net/communion-cups-1000-count',
    notes: 'Direct supplier for communion cups (1000 count boxes)',
  },
  {
    name: 'KwikCopy',
    contactPerson: 'Lydia',
    phone: null,
    email: null,
    url: null,
    notes: 'Local print shop for offering envelopes & connection cards',
  },
  {
    name: 'Precision Roller',
    contactPerson: null,
    phone: null,
    email: null,
    url: 'https://www.precisionroller.com',
    notes: 'Specialty laser printer toner cartridges',
  },
];

const buildings = [
  { name: 'The Commons' },
  { name: 'The Church' },
];

const rooms = [
  { buildingName: 'The Commons', name: 'Coffeehouse' },
  { buildingName: 'The Commons', name: 'Cleaning Closet' },
  { buildingName: 'The Commons', name: 'Kitchen' },
  { buildingName: 'The Commons', name: 'Misc' },
  { buildingName: 'The Church', name: 'Kitchen' },
  { buildingName: 'The Church', name: 'Upstairs Bathroom' },
  { buildingName: 'The Church', name: 'Foyer' },
  { buildingName: 'The Church', name: 'Cleaning Closet' },
  { buildingName: 'The Church', name: 'Fireside' },
  { buildingName: 'The Church', name: "Mother's Nursing Room" },
  { buildingName: 'The Church', name: 'Copier' },
  { buildingName: 'The Church', name: 'Cave' },
  { buildingName: 'The Church', name: 'Krew House' },
  { buildingName: 'The Church', name: 'Green Room' },
];

interface ItemSeedData {
  inventorySlug: string;
  buildingName: string;
  roomName: string;
  name: string;
  idealQty: number;
  reorderThreshold: number;
  unit: string;
  vendorName: string | null;
  shelfLocation: string | null;
  sortOrder: number;
}

const items: ItemSeedData[] = [
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "La Cosecha Bean Coffee (Decaf)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bags",
    "vendorName": null,
    "shelfLocation": "Coffee Bar Upper Shelf",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "La Cosecha Bean Coffee (Regular)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bags",
    "vendorName": null,
    "shelfLocation": "Coffee Bar Upper Shelf",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Dunkin' Donuts (Decaf Ground)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Containers",
    "vendorName": "Sam's Club",
    "shelfLocation": "Coffee Bar Upper Shelf",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Dunkin' Donuts (Regular Ground)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bags",
    "vendorName": "Sam's Club",
    "shelfLocation": "Coffee Bar Upper Shelf",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Coffee Stirrers (7.5 In)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Condiment Station",
    "sortOrder": 5
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Coffee Cups (12 oz)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Counter Left",
    "sortOrder": 6
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Coffee Lids",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Counter Left",
    "sortOrder": 7
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Milk Cleaning Tabs",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "The Bean Doctor",
    "shelfLocation": "Espresso Station Tray",
    "sortOrder": 8
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Coffee Cleaning Tabs",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bags",
    "vendorName": "The Bean Doctor",
    "shelfLocation": "Espresso Station Tray",
    "sortOrder": 9
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Sugar Packets",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Condiment Station",
    "sortOrder": 10
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Equal Packets",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Condiment Station",
    "sortOrder": 11
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Individual Coffee Creamers",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Condiment Station",
    "sortOrder": 12
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Large Machine Coffee Filters",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Packs",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Brewer",
    "sortOrder": 13
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Regular Machine Coffee Filters",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Packs",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Brewer",
    "sortOrder": 14
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Whole Milk",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Gallons",
    "vendorName": "Cece",
    "shelfLocation": "Main Fridge",
    "sortOrder": 15
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Skim Milk",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Gallons",
    "vendorName": "Cece",
    "shelfLocation": "Main Fridge",
    "sortOrder": 16
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "French Vanilla Syrup",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Flavor Rack",
    "sortOrder": 17
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Hazelnut Syrup",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Flavor Rack",
    "sortOrder": 18
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Coffeehouse",
    "name": "Liquid Dish Soap",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Sink",
    "sortOrder": 19
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Toilet Bowl Cleaner",
    "idealQty": 8,
    "reorderThreshold": 3,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Chemical Rack Row 1",
    "sortOrder": 1
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Toilet Paper (Main Bathrooms)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Packs",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay A",
    "sortOrder": 2
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Toilet Paper (Gym Restrooms)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay B",
    "sortOrder": 3
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Foaming Cleaner",
    "idealQty": 10,
    "reorderThreshold": 4,
    "unit": "Bottles",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Chemical Rack Row 2",
    "sortOrder": 4
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Vista Cleer Glass Cleaner",
    "idealQty": 10,
    "reorderThreshold": 4,
    "unit": "Bottles",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Chemical Rack Row 2",
    "sortOrder": 5
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Black Trash Bags (55 Gal)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Liner Bin Bottom",
    "sortOrder": 6
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Paper Towels (Restrooms)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay A",
    "sortOrder": 7
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Hand Soap",
    "idealQty": 20,
    "reorderThreshold": 5,
    "unit": "Bottles",
    "vendorName": "Bath & Body Works",
    "shelfLocation": "Soap Shelf",
    "sortOrder": 8
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Kitchen Trash Bags (13 Gal)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Liner Bin Bottom",
    "sortOrder": 9
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Tissues",
    "idealQty": 10,
    "reorderThreshold": 3,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Top Shelf Center",
    "sortOrder": 10
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Hand Sanitizer Refill",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Chemical Rack Row 3",
    "sortOrder": 11
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Cleaning Closet",
    "name": "Paper Towels (Kitchen Rolls)",
    "idealQty": 10,
    "reorderThreshold": 3,
    "unit": "Rolls",
    "vendorName": "Sam's Club",
    "shelfLocation": "Paper Storage Bay B",
    "sortOrder": 12
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Paper Plates (Dinner 9in)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Plates",
    "vendorName": "Amazon",
    "shelfLocation": "Pantry Cabinet 1",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Forks (Plastic)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Forks",
    "vendorName": "Amazon",
    "shelfLocation": "Cutlery Bin Left",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Spoons (Plastic)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Spoons",
    "vendorName": "Sam's Club",
    "shelfLocation": "Cutlery Bin Middle",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Knives (Plastic)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Knives",
    "vendorName": "Sam's Club",
    "shelfLocation": "Cutlery Bin Right",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Napkins (Dinner)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Napkins",
    "vendorName": "Sam's Club",
    "shelfLocation": "Pantry Cabinet 2",
    "sortOrder": 5
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Clear Plastic Cups (9 oz)",
    "idealQty": 200,
    "reorderThreshold": 50,
    "unit": "Cups",
    "vendorName": "Sam's Club",
    "shelfLocation": "Pantry Cabinet 3",
    "sortOrder": 6
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Dessert Plates (6in)",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Plates",
    "vendorName": "Sam's Club",
    "shelfLocation": "Pantry Cabinet 1",
    "sortOrder": 7
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Kitchen",
    "name": "Liquid Dish Soap",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Kitchen Sink",
    "sortOrder": 8
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Pads / Tampons / Liners",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Restroom Restock Caddy",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Coca-Cola (Classic)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Storage Rack",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Sprite",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Storage Rack",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Diet Coke",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Storage Rack",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Bottled Water (16 oz)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Pallet",
    "sortOrder": 5
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Bottled Water (8 oz Mini)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Pallet",
    "sortOrder": 6
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "La Croix Sparkling Water",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Beverage Storage Rack",
    "sortOrder": 7
  },
  {
    "inventorySlug": "kids-nursery",
    "buildingName": "The Commons",
    "roomName": "Misc",
    "name": "Diaper Genie Refills",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Nursery Closet Top Shelf",
    "sortOrder": 8
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Trader Joe's Ground Regular Coffee",
    "idealQty": 20,
    "reorderThreshold": 12,
    "unit": "Bags",
    "vendorName": "Cece",
    "shelfLocation": "Coffee Cabinet Top",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Trader Joe's Ground Decaf Coffee",
    "idealQty": 20,
    "reorderThreshold": 12,
    "unit": "Bags",
    "vendorName": "Cece",
    "shelfLocation": "Coffee Cabinet Top",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Half And Half",
    "idealQty": 8,
    "reorderThreshold": 2,
    "unit": "Cartons",
    "vendorName": "Sam's Club",
    "shelfLocation": "Kitchen Fridge",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Coffee Stirrers (7.5 In)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Coffee Counter",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Coffee Cups",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Counter Left",
    "sortOrder": 5
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Coffee Lids",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Counter Left",
    "sortOrder": 6
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Water Bottles (Fridge Restock)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Packs",
    "vendorName": "Sam's Club",
    "shelfLocation": "Kitchen Fridge Bottom",
    "sortOrder": 7
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Sugar Packets",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Coffee Counter",
    "sortOrder": 8
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Equal Packets",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Coffee Counter",
    "sortOrder": 9
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "French Vanilla Creamer",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Coffee Counter",
    "sortOrder": 10
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Hazelnut Creamer",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Coffee Counter",
    "sortOrder": 11
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Coffee Napkins",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Napkins",
    "vendorName": "Sam's Club",
    "shelfLocation": "Pantry Left",
    "sortOrder": 12
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Tissues",
    "idealQty": 10,
    "reorderThreshold": 3,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Pantry Left",
    "sortOrder": 13
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Liquid Dish Soap",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Sink",
    "sortOrder": 14
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Dishwasher Pods",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Containers",
    "vendorName": "Sam's Club",
    "shelfLocation": "Under Sink",
    "sortOrder": 15
  },
  {
    "inventorySlug": "liturgical-worship",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Communion Cups (1000ct)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Communion Cups Direct",
    "shelfLocation": "Communion Prep Cabinet",
    "sortOrder": 16
  },
  {
    "inventorySlug": "liturgical-worship",
    "buildingName": "The Church",
    "roomName": "Kitchen",
    "name": "Grape Juice for Communion",
    "idealQty": 6,
    "reorderThreshold": 2,
    "unit": "Bottles",
    "vendorName": "Cece",
    "shelfLocation": "Communion Prep Cabinet",
    "sortOrder": 17
  },
  {
    "inventorySlug": "kids-nursery",
    "buildingName": "The Church",
    "roomName": "Upstairs Bathroom",
    "name": "Baby Wipes (96 Wipes/Pack)",
    "idealQty": 12,
    "reorderThreshold": 3,
    "unit": "Packs",
    "vendorName": "Sam's Club",
    "shelfLocation": "Changing Table Lower Shelf",
    "sortOrder": 1
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Upstairs Bathroom",
    "name": "Tampons (Multi-Size)",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Restroom Vanity Shelf",
    "sortOrder": 2
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Upstairs Bathroom",
    "name": "Panty Liners",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Restroom Vanity Shelf",
    "sortOrder": 3
  },
  {
    "inventorySlug": "liturgical-worship",
    "buildingName": "The Church",
    "roomName": "Foyer",
    "name": "Offering Envelopes",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "KwikCopy",
    "shelfLocation": "Welcome Desk Drawer",
    "sortOrder": 1
  },
  {
    "inventorySlug": "liturgical-worship",
    "buildingName": "The Church",
    "roomName": "Foyer",
    "name": "Connection Cards",
    "idealQty": 500,
    "reorderThreshold": 100,
    "unit": "Cards",
    "vendorName": "KwikCopy",
    "shelfLocation": "Welcome Desk Drawer",
    "sortOrder": 2
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Foyer",
    "name": "Pens (Welcome Desk)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Amazon",
    "shelfLocation": "Welcome Desk Drawer",
    "sortOrder": 3
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Toilet Bowl Cleaner",
    "idealQty": 10,
    "reorderThreshold": 3,
    "unit": "Bottles",
    "vendorName": "Sam's Club",
    "shelfLocation": "Chemical Rack 1",
    "sortOrder": 1
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Toilet Paper (Rolls)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay A",
    "sortOrder": 2
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Foaming Cleaner",
    "idealQty": 15,
    "reorderThreshold": 4,
    "unit": "Bottles",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Chemical Rack 2",
    "sortOrder": 3
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Vista Clear Glass Cleaner",
    "idealQty": 15,
    "reorderThreshold": 4,
    "unit": "Bottles",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Chemical Rack 2",
    "sortOrder": 4
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Black Trash Bags (55 Gal)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Liner Bin",
    "sortOrder": 5
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Paper Towels (Restroom Roll)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay B",
    "sortOrder": 6
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Tri-Fold Paper Towels",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "All Type Vacuum",
    "shelfLocation": "Paper Storage Bay B",
    "sortOrder": 7
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Hand Soap (Bath & Body Works)",
    "idealQty": 20,
    "reorderThreshold": 5,
    "unit": "Bottles",
    "vendorName": "Bath & Body Works",
    "shelfLocation": "Soap Shelf Top",
    "sortOrder": 8
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Foamy IQ Soap (Eucalyptus/Mint)",
    "idealQty": 4,
    "reorderThreshold": 1,
    "unit": "Bottles",
    "vendorName": "Amazon",
    "shelfLocation": "Soap Shelf Middle",
    "sortOrder": 9
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Kitchen Trash Bags (13 Gal)",
    "idealQty": 3,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Liner Bin",
    "sortOrder": 10
  },
  {
    "inventorySlug": "facilities-janitorial",
    "buildingName": "The Church",
    "roomName": "Cleaning Closet",
    "name": "Paper Towels (Kitchen)",
    "idealQty": 20,
    "reorderThreshold": 5,
    "unit": "Rolls",
    "vendorName": "Sam's Club",
    "shelfLocation": "Paper Storage Bay B",
    "sortOrder": 11
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Fireside",
    "name": "Bottled Water (Fireside Room)",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Corner Storage Cabinet",
    "sortOrder": 1
  },
  {
    "inventorySlug": "kids-nursery",
    "buildingName": "The Church",
    "roomName": "Mother's Nursing Room",
    "name": "Made Good Granola Bites",
    "idealQty": 15,
    "reorderThreshold": 5,
    "unit": "Bars",
    "vendorName": "Sam's Club",
    "shelfLocation": "Snack Basket",
    "sortOrder": 1
  },
  {
    "inventorySlug": "kids-nursery",
    "buildingName": "The Church",
    "roomName": "Mother's Nursing Room",
    "name": "Bobo's Muffins",
    "idealQty": 15,
    "reorderThreshold": 5,
    "unit": "Bars",
    "vendorName": "Sam's Club",
    "shelfLocation": "Snack Basket",
    "sortOrder": 2
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Copier",
    "name": "Toner Cartridge (Black)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Toners",
    "vendorName": "Precision Roller",
    "shelfLocation": "Toner Cabinet Shelf 1",
    "sortOrder": 1
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Copier",
    "name": "Toner Cartridge (Magenta)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Toners",
    "vendorName": "Precision Roller",
    "shelfLocation": "Toner Cabinet Shelf 1",
    "sortOrder": 2
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Copier",
    "name": "Toner Cartridge (Yellow)",
    "idealQty": 2,
    "reorderThreshold": 1,
    "unit": "Toners",
    "vendorName": "Precision Roller",
    "shelfLocation": "Toner Cabinet Shelf 1",
    "sortOrder": 3
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Copier",
    "name": "Copy Paper (Letter 8.5x11)",
    "idealQty": 5,
    "reorderThreshold": 2,
    "unit": "Reams",
    "vendorName": "Amazon",
    "shelfLocation": "Paper Pallet Rack",
    "sortOrder": 4
  },
  {
    "inventorySlug": "office-print",
    "buildingName": "The Church",
    "roomName": "Copier",
    "name": "Cardstock (White 65lb)",
    "idealQty": 5,
    "reorderThreshold": 2,
    "unit": "Reams",
    "vendorName": "Amazon",
    "shelfLocation": "Specialty Paper Shelf",
    "sortOrder": 5
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Cave",
    "name": "Paper Plates (Dinner)",
    "idealQty": 200,
    "reorderThreshold": 50,
    "unit": "Plates",
    "vendorName": "Sam's Club",
    "shelfLocation": "Storage Bin A",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Cave",
    "name": "Dessert Plates (6in)",
    "idealQty": 200,
    "reorderThreshold": 50,
    "unit": "Plates",
    "vendorName": "Sam's Club",
    "shelfLocation": "Storage Bin A",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Cave",
    "name": "Assorted Plastic Utensils",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Boxes",
    "vendorName": "Sam's Club",
    "shelfLocation": "Storage Bin B",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Cave",
    "name": "Paper Napkins",
    "idealQty": 200,
    "reorderThreshold": 50,
    "unit": "Napkins",
    "vendorName": "Sam's Club",
    "shelfLocation": "Storage Bin B",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Krew House",
    "name": "Cups (Cold 16 oz)",
    "idealQty": 300,
    "reorderThreshold": 50,
    "unit": "Cups",
    "vendorName": "Sam's Club",
    "shelfLocation": "Kitchen Island Shelf",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Krew House",
    "name": "Paper Plates",
    "idealQty": 300,
    "reorderThreshold": 50,
    "unit": "Plates",
    "vendorName": "Sam's Club",
    "shelfLocation": "Kitchen Island Shelf",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Green Room",
    "name": "Coffee Pods (Keurig K-Cups)",
    "idealQty": 20,
    "reorderThreshold": 5,
    "unit": "Pods",
    "vendorName": "Sam's Club",
    "shelfLocation": "Hospitality Drawer 1",
    "sortOrder": 1
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Green Room",
    "name": "Nature Valley Protein Bars",
    "idealQty": 15,
    "reorderThreshold": 5,
    "unit": "Bars",
    "vendorName": "Sam's Club",
    "shelfLocation": "Snack Basket",
    "sortOrder": 2
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Green Room",
    "name": "Nature Valley Almond Butter Biscuits",
    "idealQty": 15,
    "reorderThreshold": 5,
    "unit": "Bars",
    "vendorName": "Sam's Club",
    "shelfLocation": "Snack Basket",
    "sortOrder": 3
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Green Room",
    "name": "La Croix Sparkling Water",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Mini Fridge",
    "sortOrder": 4
  },
  {
    "inventorySlug": "weekly-consumables",
    "buildingName": "The Church",
    "roomName": "Green Room",
    "name": "Mini Water Bottles (8 oz)",
    "idealQty": 1,
    "reorderThreshold": 1,
    "unit": "Cases",
    "vendorName": "Sam's Club",
    "shelfLocation": "Mini Fridge",
    "sortOrder": 5
  }
];

async function main() {
  console.log('Seeding inventory data...');

  // 1. Inventory Types (upsert by unique slug)
  const typeMap = new Map<string, string>();
  for (const t of inventoryTypes) {
    const record = await prisma.inventoryType.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        trackingMode: t.trackingMode,
        cadence: t.cadence,
        icon: t.icon,
      },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        trackingMode: t.trackingMode,
        cadence: t.cadence,
        icon: t.icon,
      },
    });
    typeMap.set(record.slug, record.id);
  }
  console.log(`Upserted ${inventoryTypes.length} inventory types.`);

  // 2. Vendors (Vendor.name is not unique -> findFirst by name, then create only if missing)
  const vendorMap = new Map<string, string>();
  for (const v of vendors) {
    let record = await prisma.vendor.findFirst({
      where: { name: v.name },
    });
    if (!record) {
      record = await prisma.vendor.create({
        data: {
          name: v.name,
          contactPerson: v.contactPerson,
          phone: v.phone,
          email: v.email,
          url: v.url,
          notes: v.notes,
        },
      });
    }
    vendorMap.set(record.name, record.id);
  }
  console.log(`Resolved ${vendors.length} vendors.`);

  // 3. Buildings (Building.name is unique -> upsert)
  const buildingMap = new Map<string, string>();
  for (const b of buildings) {
    const record = await prisma.building.upsert({
      where: { name: b.name },
      update: {},
      create: { name: b.name },
    });
    buildingMap.set(record.name, record.id);
  }
  console.log(`Upserted ${buildings.length} buildings.`);

  // 4. Rooms (compound unique @@unique([buildingId, name]) -> upsert)
  const roomMap = new Map<string, string>();
  for (const r of rooms) {
    const buildingId = buildingMap.get(r.buildingName);
    if (!buildingId) {
      throw new Error(`Building not found for room: ${r.buildingName}`);
    }
    const record = await prisma.room.upsert({
      where: {
        buildingId_name: {
          buildingId,
          name: r.name,
        },
      },
      update: {},
      create: {
        buildingId,
        name: r.name,
      },
    });
    roomMap.set(`${r.buildingName}::${r.name}`, record.id);
  }
  console.log(`Upserted ${rooms.length} rooms.`);

  // 5. Inventory Items (no unique constraint -> findFirst by { roomId, name }, create if missing / update if present)
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const roomId = roomMap.get(`${item.buildingName}::${item.roomName}`);
    if (!roomId) {
      throw new Error(`Room not found for item: ${item.buildingName}::${item.roomName}`);
    }
    const inventoryTypeId = item.inventorySlug ? typeMap.get(item.inventorySlug) ?? null : null;
    const vendorId = item.vendorName ? vendorMap.get(item.vendorName) ?? null : null;

    const existingItem = await prisma.inventoryItem.findFirst({
      where: {
        roomId,
        name: item.name,
      },
    });

    if (existingItem) {
      await prisma.inventoryItem.update({
        where: { id: existingItem.id },
        data: {
          inventoryTypeId,
          unit: item.unit,
          idealQty: item.idealQty,
          reorderThreshold: item.reorderThreshold,
          shelfLocation: item.shelfLocation,
          sortOrder: item.sortOrder,
          vendorId,
        },
      });
      updatedCount++;
    } else {
      await prisma.inventoryItem.create({
        data: {
          roomId,
          inventoryTypeId,
          name: item.name,
          unit: item.unit,
          idealQty: item.idealQty,
          onHandQty: 0,
          reorderThreshold: item.reorderThreshold,
          shelfLocation: item.shelfLocation,
          sortOrder: item.sortOrder,
          vendorId,
        },
      });
      createdCount++;
    }
  }

  console.log(`Processed ${items.length} inventory items (created: ${createdCount}, updated: ${updatedCount}).`);

  // Report table counts
  const [totalTypes, totalVendors, totalBuildings, totalRooms, totalItems] = await Promise.all([
    prisma.inventoryType.count(),
    prisma.vendor.count(),
    prisma.building.count(),
    prisma.room.count(),
    prisma.inventoryItem.count(),
  ]);

  console.log('\nFinal Row Counts:');
  console.log(`  InventoryType: ${totalTypes}`);
  console.log(`  Vendor:        ${totalVendors}`);
  console.log(`  Building:      ${totalBuildings}`);
  console.log(`  Room:          ${totalRooms}`);
  console.log(`  InventoryItem: ${totalItems}`);
  console.log('\nInventory seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
