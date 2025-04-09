import mongoose, { Schema } from "mongoose";
import { ICharacter } from "../interface/avatar";

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  image: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["Fighter", "Ninja", "Demon", "Warrior"],
  },
  level: { type: Number, default: 1 },
  power: { type: Number},
  defense: { type: Number},
  speed: { type: Number},
});

export const Character = mongoose.model<ICharacter>(
  "Character",
  CharacterSchema
);
