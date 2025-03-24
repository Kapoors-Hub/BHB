// services/xpService.js
const Hunter = require('../models/Hunter');

// XP increment constants
const XP_INCREMENTS = {
  SMALL: 125,
  MEDIUM: 375,
  LARGE: 625
};

// Calculate XP from review scores
const calculateReviewXP = (scores) => {
  let xpChange = 0;
  
  // Apply XP calculation formula for each parameter:
  // Scores above 2.5: score * 100 XP
  // Scores below 2.5: -1 * (3-score) * 100 XP
  scores.forEach(score => {
    if (score >= 3) {
      xpChange += score * 100;
    } else if (score <= 2) {
      xpChange -= (3 - score) * 100;
    }
  });
  
  return xpChange;
};

// Update hunter's XP
const updateHunterXP = async (hunterId, xpAmount) => {
  try {
    const hunter = await Hunter.findById(hunterId);
    if (hunter) {
      hunter.xp += xpAmount;
      await hunter.save();
      return hunter.xp;
    }
    return null;
  } catch (error) {
    console.error('Error updating hunter XP:', error);
    throw error;
  }
};

// Add small XP increment (125)
const addSmallXP = async (hunterId) => {
  return await updateHunterXP(hunterId, XP_INCREMENTS.SMALL);
};

// Add medium XP increment (375)
const addMediumXP = async (hunterId) => {
  return await updateHunterXP(hunterId, XP_INCREMENTS.MEDIUM);
};

// Add large XP increment (625)
const addLargeXP = async (hunterId) => {
  return await updateHunterXP(hunterId, XP_INCREMENTS.LARGE);
};

// Subtract small XP decrement (125)
const subtractSmallXP = async (hunterId) => {
  return await updateHunterXP(hunterId, -XP_INCREMENTS.SMALL);
};

// Subtract medium XP decrement (375)
const subtractMediumXP = async (hunterId) => {
  return await updateHunterXP(hunterId, -XP_INCREMENTS.MEDIUM);
};

// Subtract large XP decrement (625)
const subtractLargeXP = async (hunterId) => {
  return await updateHunterXP(hunterId, -XP_INCREMENTS.LARGE);
};

// Get XP increment by name (small, medium, large)
const getXPBySize = (size) => {
  switch(size.toLowerCase()) {
    case 'small':
      return XP_INCREMENTS.SMALL;
    case 'medium':
      return XP_INCREMENTS.MEDIUM;
    case 'large':
      return XP_INCREMENTS.LARGE;
    default:
      throw new Error(`Invalid XP size: ${size}. Must be 'small', 'medium', or 'large'.`);
  }
};

// Add XP by size name
const addXPBySize = async (hunterId, size) => {
  const xpAmount = getXPBySize(size);
  return await updateHunterXP(hunterId, xpAmount);
};

// Subtract XP by size name
const subtractXPBySize = async (hunterId, size) => {
  const xpAmount = getXPBySize(size);
  return await updateHunterXP(hunterId, -xpAmount);
};

module.exports = {
  XP_INCREMENTS,
  calculateReviewXP,
  updateHunterXP,
  addSmallXP,
  addMediumXP,
  addLargeXP,
  subtractSmallXP,
  subtractMediumXP,
  subtractLargeXP,
  getXPBySize,
  addXPBySize,
  subtractXPBySize
};