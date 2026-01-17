import { FlightOption, AccommodationOption, Activity, Trip } from '@/types';

// Generate unique invite code
export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Flight scoring logic
export function scoreFlights(options: FlightOption[]): FlightOption[] {
  if (options.length === 0) return options;

  // Normalize values
  const prices = options.map(opt => opt.roundTripPrice ?? opt.price);
  const durations = options.map(opt => opt.totalDuration ?? opt.duration);
  const layoverCounts = options.map(opt => opt.returnSegment
    ? opt.layovers.count + opt.returnSegment.layovers.count
    : opt.layovers.count
  );

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const minLayovers = Math.min(...layoverCounts);
  const maxLayovers = Math.max(...layoverCounts);

  const priceRange = maxPrice - minPrice || 1;
  const durationRange = maxDuration - minDuration || 1;
  const layoverRange = maxLayovers - minLayovers || 1;

  // Score each option
  const scored = options.map(opt => {
    // Lower is better for price, duration, layovers
    const priceValue = opt.roundTripPrice ?? opt.price;
    const durationValue = opt.totalDuration ?? opt.duration;
    const layoverValue = opt.returnSegment
      ? opt.layovers.count + opt.returnSegment.layovers.count
      : opt.layovers.count;

    const priceScore = 1 - (priceValue - minPrice) / priceRange; // 0-1
    const durationScore = 1 - (durationValue - minDuration) / durationRange;
    const layoverScore = 1 - (layoverValue - minLayovers) / layoverRange;

    // Weighted score
    const totalScore = (
      priceScore * 0.45 +
      durationScore * 0.35 +
      layoverScore * 0.20
    ) * 100;

    return { ...opt, score: Math.round(totalScore) };
  });

  // Find best options
  const cheapest = scored.reduce((prev, curr) => 
    (curr.roundTripPrice ?? curr.price) < (prev.roundTripPrice ?? prev.price) ? curr : prev
  );
  const fastest = scored.reduce((prev, curr) => 
    (curr.totalDuration ?? curr.duration) < (prev.totalDuration ?? prev.duration) ? curr : prev
  );
  const bestValue = scored.reduce((prev, curr) => 
    curr.score > prev.score ? curr : prev
  );

  // Mark highlights
  return scored.map(opt => ({
    ...opt,
    isCheapest: opt.id === cheapest.id,
    isFastest: opt.id === fastest.id,
    isBestValue: opt.id === bestValue.id,
  }));
}

// Accommodation scoring logic
export function scoreAccommodations(
  options: AccommodationOption[],
  preferences: { minBudget: number; maxBudget: number }
): AccommodationOption[] {
  if (options.length === 0) return options;

  // Normalize budget and rating
  const prices = options.map(opt => opt.pricePerNight);
  const ratings = options.map(opt => opt.rating);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const avgBudget = (preferences.minBudget + preferences.maxBudget) / 2;
  const budgetRange = preferences.maxBudget - preferences.minBudget || 1;

  return options.map(opt => {
    // Budget score: closer to average budget = better
    const budgetDistance = Math.abs(opt.pricePerNight - avgBudget);
    const budgetScore = 1 - Math.min(budgetDistance / budgetRange, 1);

    // Rating score: normalized to 0-1
    const ratingScore = opt.rating / 5;

    // Combined score (50% budget, 50% rating)
    const totalScore = (budgetScore * 0.5 + ratingScore * 0.5) * 100;

    return { ...opt, score: Math.round(totalScore) };
  }).sort((a, b) => b.score - a.score);
}

// Activity 80% rule validation
export function validateActivitySelection(
  activities: Activity[],
  userIds: string[]
): { isValid: boolean; conflicts: string[] } {
  const selectedActivities = activities.filter(a => a.isSelected);
  
  if (selectedActivities.length === 0) {
    return { isValid: false, conflicts: [] };
  }

  const conflicts: string[] = [];

  for (const userId of userIds) {
    const userRatings = selectedActivities.filter(activity => {
      const rating = activity.ratings[userId] || 0;
      return rating >= 3; // "okay" or better
    });

    const percentage = userRatings.length / selectedActivities.length;
    
    if (percentage < 0.8) {
      conflicts.push(userId);
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}

// Calculate average ratings for activities
export function updateActivityRatings(activities: Activity[]): Activity[] {
  return activities.map(activity => {
    const ratings = Object.values(activity.ratings);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // Find users who rated < 3
    const conflicts = Object.entries(activity.ratings)
      .filter(([_, rating]) => rating < 3)
      .map(([userId]) => userId);

    return {
      ...activity,
      averageRating: Math.round(averageRating * 10) / 10,
      conflicts,
    };
  });
}