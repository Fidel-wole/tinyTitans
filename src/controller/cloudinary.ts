import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from "../config/env";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

export const uploadImage = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        status: "error",
        message: "No file uploaded",
      });
      return;
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "uploads",
    });

    fs.unlinkSync(file.path);

    res.status(200).json({
      status: "success",
      message: "Image uploaded successfully",
      data: {
        url: result.secure_url,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Failed to upload image",
    });
    return;
  }
};
