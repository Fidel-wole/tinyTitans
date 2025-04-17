import mongoose, { Schema } from "mongoose";
import { ICharacter } from "../interface/avatar";

const CharacterSchema = new Schema<ICharacter>({
  // Basic Information
  name: { type: String, required: true },
  image: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["Fighter", "Ninja", "Demon", "Warrior"],
  },
  
  // Combat Attributes
  level: { type: Number, default: 1 },
  power: { type: Number, default: 10 },
  defense: { type: Number, default: 5 },
  speed: { type: Number, default: 5 },
  health: { type: Number, required: true, default: 100 },
  
  // Visual/Type Attributes
  race: { type: String, required: true, default: "Human" },
  rarity: {
    type: String,
    required: true,
    enum: ["Common", "Rare", "Epic", "Legendary"],
    default: "Common"
  },
  abilities: [{ type: String }],
  appearance: {
    skinColor: { type: String },
    hairColor: { type: String },
    eyeColor: { type: String },
    accessories: [{ type: String }]
  }
}, {
  timestamps: true
});

// Indexes for better query performance
CharacterSchema.index({ walletAddress: 1 });
CharacterSchema.index({ referralCode: 1 });
CharacterSchema.index({ teamId: 1 });

export const Character = mongoose.model<ICharacter>("Character", CharacterSchema);
