import {
  Home, Zap, Car, ShoppingCart, TrendingUp, Users, Smartphone,
  MoreHorizontal, Tag, Briefcase, Heart, Coffee, Book, Plane,
  Gamepad2, Shirt, Dumbbell
} from 'lucide-react';

export function CategoryIcon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const n = (name || '').toLowerCase();
  
  if (n.includes('rent') || n.includes('house') || n.includes('home')) return <Home size={size} color={color} />;
  if (n.includes('electric') || n.includes('bill') || n.includes('util')) return <Zap size={size} color={color} />;
  if (n.includes('travel') || n.includes('commute') || n.includes('car')) return <Car size={size} color={color} />;
  if (n.includes('grocer') || n.includes('shop') || n.includes('mart')) return <ShoppingCart size={size} color={color} />;
  if (n.includes('invest') || n.includes('stock') || n.includes('save')) return <TrendingUp size={size} color={color} />;
  if (n.includes('family') || n.includes('child') || n.includes('depend')) return <Users size={size} color={color} />;
  if (n.includes('subscript') || n.includes('phone') || n.includes('app') || n.includes('internet')) return <Smartphone size={size} color={color} />;
  if (n.includes('health') || n.includes('medic') || n.includes('doctor')) return <Heart size={size} color={color} />;
  if (n.includes('food') || n.includes('dine') || n.includes('restaurant') || n.includes('coffee')) return <Coffee size={size} color={color} />;
  if (n.includes('edu') || n.includes('book') || n.includes('school')) return <Book size={size} color={color} />;
  if (n.includes('flight') || n.includes('trip') || n.includes('holiday')) return <Plane size={size} color={color} />;
  if (n.includes('game') || n.includes('play') || n.includes('fun')) return <Gamepad2 size={size} color={color} />;
  if (n.includes('clothes') || n.includes('apparel') || n.includes('shopping')) return <Shirt size={size} color={color} />;
  if (n.includes('gym') || n.includes('fitness') || n.includes('sport')) return <Dumbbell size={size} color={color} />;
  if (n.includes('misc') || n.includes('other')) return <MoreHorizontal size={size} color={color} />;
  
  return <Tag size={size} color={color} />;
}
