import {
  Home, Zap, Car, ShoppingCart, TrendingUp, Users, Smartphone,
  MoreHorizontal, Tag, Heart, Coffee, Book, Plane,
  Gamepad2, Shirt, Dumbbell, Utensils, Scissors, Pill, Monitor,
  Music, Film, Wifi, Train, Bus, Bike, Fuel, Droplet, Wrench,
  Dog, GraduationCap, Tv, Gift, Wine, Baby, Hammer,
  Scale, Landmark, Umbrella, Camera, CheckSquare
} from 'lucide-react';

const ICON_RULES = [
  // Notes / Specifics
  { keywords: ['swiggy', 'zomato', 'lunch', 'dinner', 'breakfast', 'food', 'eat', 'meal', 'pizza', 'burger', 'restaurant', 'instamart', 'blinkit', 'zepto'], icon: Utensils },
  { keywords: ['tea', 'coffee', 'cafe', 'chai', 'starbucks', 'beverage'], icon: Coffee },
  { keywords: ['badminton', 'tennis', 'cricket', 'football', 'gym', 'fitness', 'workout', 'sport', 'yoga'], icon: Dumbbell },
  { keywords: ['movie', 'cinema', 'netflix', 'film', 'theatre', 'prime', 'hotstar', 'ticket', 'show'], icon: Film },
  { keywords: ['music', 'spotify', 'concert', 'song', 'apple music', 'gaana'], icon: Music },
  { keywords: ['wifi', 'internet', 'broadband', 'jio', 'airtel', 'vi', 'bsnl'], icon: Wifi },
  { keywords: ['train', 'metro', 'railway', 'irctc'], icon: Train },
  { keywords: ['bus', 'redbus', 'volvo'], icon: Bus },
  { keywords: ['bike', 'cycle', 'scooter', 'rapido', 'motorcycle'], icon: Bike },
  { keywords: ['fuel', 'petrol', 'diesel', 'gas', 'pump', 'cng'], icon: Fuel },
  { keywords: ['water', 'plumber', 'bisleri', 'aquaguard'], icon: Droplet },
  { keywords: ['repair', 'fix', 'service', 'mechanic', 'hardware'], icon: Wrench },
  { keywords: ['pill', 'medicine', 'pharmacy', 'apollo', 'doctor', 'hospital', 'clinic', 'health', 'med', 'medical'], icon: Pill },
  { keywords: ['haircut', 'salon', 'spa', 'barber', 'beauty', 'makeup', 'cosmetic'], icon: Scissors },
  { keywords: ['laptop', 'computer', 'monitor', 'screen', 'tech', 'apple', 'cable', 'charger', 'electronics'], icon: Monitor },
  { keywords: ['pet', 'dog', 'cat', 'vet', 'animal'], icon: Dog },
  { keywords: ['tuition', 'fee', 'college', 'university', 'exam', 'course', 'degree', 'student'], icon: GraduationCap },
  { keywords: ['tv', 'television', 'dth', 'tata sky'], icon: Tv },
  { keywords: ['gift', 'present', 'birthday', 'anniversary', 'donation', 'charity'], icon: Gift },
  { keywords: ['wine', 'beer', 'alcohol', 'pub', 'bar', 'drinks', 'liquor'], icon: Wine },
  { keywords: ['baby', 'diaper', 'toys', 'kids', 'child'], icon: Baby },
  { keywords: ['paint', 'wood', 'tools', 'ikea', 'furniture', 'home improvement'], icon: Hammer },
  { keywords: ['tax', 'legal', 'lawyer', 'ca', 'accountant', 'gst', 'penalty'], icon: Scale },
  { keywords: ['fee', 'charge', 'interest', 'emi', 'loan', 'bank', 'atm'], icon: Landmark },
  { keywords: ['vacation', 'resort', 'hotel', 'beach', 'tour', 'insurance'], icon: Umbrella },
  { keywords: ['photo', 'camera', 'studio'], icon: Camera },
  { keywords: ['laundry', 'wash', 'dry clean', 'detergent', 'surf excel'], icon: Shirt },

  // General Categories Fallbacks
  { keywords: ['rent', 'house', 'home', 'housing', 'stay'], icon: Home },
  { keywords: ['electric', 'bill', 'util', 'power'], icon: Zap },
  { keywords: ['travel', 'commute', 'car', 'cab', 'uber', 'ola'], icon: Car },
  { keywords: ['grocer', 'shop', 'mart', 'market', 'supermarket', 'dmart', 'bigbasket'], icon: ShoppingCart },
  { keywords: ['invest', 'stock', 'save', 'sip', 'mutual', 'zerodha', 'groww'], icon: TrendingUp },
  { keywords: ['family', 'depend', 'brother', 'sister', 'parent', 'mom', 'dad'], icon: Users },
  { keywords: ['subscript', 'phone', 'app', 'recharge', 'mobile'], icon: Smartphone },
  { keywords: ['edu', 'book', 'school', 'stationery', 'notebook'], icon: Book },
  { keywords: ['flight', 'trip', 'holiday', 'air'], icon: Plane },
  { keywords: ['game', 'play', 'fun', 'steam', 'playstation', 'xbox'], icon: Gamepad2 },
  { keywords: ['clothes', 'apparel', 'shopping', 'myntra', 'amazon', 'flipkart', 'shoes', 'wear'], icon: Shirt },
  { keywords: ['health'], icon: Heart },
  { keywords: ['misc', 'other'], icon: MoreHorizontal },
];

export function CategoryIcon({ name, note, size = 18, color, inList = false }: { name: string; note?: string; size?: number; color?: string; inList?: boolean }) {
  const n = (name || '').toLowerCase();
  const txt = note ? (note + ' ' + n).toLowerCase() : n;
  
  let IconComp = Tag;
  for (const rule of ICON_RULES) {
    if (rule.keywords.some(kw => txt.includes(kw))) {
      IconComp = rule.icon;
      break;
    }
  }

  const icon = <IconComp size={size} color={color || "currentColor"} />;

  if (inList) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: size * 2.2, height: size * 2.2,
        borderRadius: '50%',
        background: color ? `${color}1A` : 'var(--bg-card)',
        color: color || 'var(--text-primary)',
        flexShrink: 0
      }}>
        {icon}
      </div>
    );
  }

  return icon;
}
