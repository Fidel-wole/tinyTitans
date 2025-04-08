import mongoose, { Schema } from "mongoose";
import { ICharacter } from "../interface/avatar";

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["Fighter", "Ninja", "Demon", "Warrior"],
  },
  level: { type: Number, default: 1 },
  power: { type: Number, required: true },
  defense: { type: Number, required: true },
  speed: { type: Number, required: true },
});

export const Character = mongoose.model<ICharacter>(
  "Character",
  CharacterSchema
);
