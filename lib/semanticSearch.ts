import { Category, Expense } from './types';

export function semanticFilterExpenses(
  expenses: Expense[],
  query: string,
  categories: Category[]
): Expense[] {
  if (!query || !query.trim()) return expenses;

  const q = query.toLowerCase().trim();

  // Extract amount criteria if specified in natural text (e.g., "over 500", "under 2000", "> 1000")
  const overMatch = q.match(/(?:over|greater than|>)\s*(\d+)/i);
  const minAmount = overMatch ? parseFloat(overMatch[1]) : null;

  const underMatch = q.match(/(?:under|less than|<)\s*(\d+)/i);
  const maxAmount = underMatch ? parseFloat(underMatch[1]) : null;

  // Extract weekend filter intent
  const isWeekendIntent = q.includes('weekend') || q.includes('saturday') || q.includes('sunday');

  // Intent keyword mappings
  const foodKeywords = ['food', 'dining', 'eating', 'lunch', 'dinner', 'swiggy', 'zomato', 'chai', 'snack', 'cafe', 'restaurant'];
  const travelKeywords = ['travel', 'commute', 'cab', 'uber', 'ola', 'auto', 'fuel', 'petrol', 'flight', 'train', 'metro'];
  const fitnessKeywords = ['badminton', 'gym', 'sports', 'fitness', 'workout', 'turf'];
  const groceryKeywords = ['grocery', 'supermarket', 'blinkit', 'zepto', 'bigbasket', 'provisions'];

  const matchesCategoryOrKeyword = (exp: Expense, keywords: string[]) => {
    const cat = categories.find(c => c.id === exp.categoryId);
    const catName = cat?.name?.toLowerCase() || '';
    const note = exp.note?.toLowerCase() || '';
    const tags = (exp.tags || []).map(t => t.toLowerCase());

    return keywords.some(k => catName.includes(k) || note.includes(k) || tags.some(t => t.includes(k)));
  };

  return expenses.filter(exp => {
    // 1. Amount check
    if (minAmount !== null && exp.amount <= minAmount) return false;
    if (maxAmount !== null && exp.amount >= maxAmount) return false;

    // 2. Weekend check
    if (isWeekendIntent) {
      const day = new Date(exp.date).getDay();
      if (day !== 0 && day !== 6) return false;
    }

    // 3. Category / Concept Intent Check
    let matchesConcept = false;
    if (q.includes('food') || q.includes('dining')) {
      matchesConcept = matchesCategoryOrKeyword(exp, foodKeywords);
    } else if (q.includes('travel') || q.includes('commute')) {
      matchesConcept = matchesCategoryOrKeyword(exp, travelKeywords);
    } else if (q.includes('badminton') || q.includes('sports') || q.includes('fitness')) {
      matchesConcept = matchesCategoryOrKeyword(exp, fitnessKeywords);
    } else if (q.includes('grocery') || q.includes('market')) {
      matchesConcept = matchesCategoryOrKeyword(exp, groceryKeywords);
    } else {
      // General direct keyword match across note, category name, amount, or tags
      const cat = categories.find(c => c.id === exp.categoryId);
      const note = exp.note?.toLowerCase() || '';
      const catName = cat?.name?.toLowerCase() || '';
      const tags = (exp.tags || []).map(t => t.toLowerCase());

      matchesConcept = note.includes(q) || catName.includes(q) || String(exp.amount).includes(q) || tags.some(t => t.includes(q));
    }

    return matchesConcept;
  });
}
