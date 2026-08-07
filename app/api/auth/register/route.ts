import { connectMongoDB } from "@/src/backend/lib/mongodb";
import User from "@/src/backend/models/User";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Category, Workspace } from "@/src/backend/models";
import Wallet from "@/src/backend/models/Wallet";
import { getCurrencyByCode } from "@/src/backend/utils/currency";

export const POST = async (req: NextRequest) => {
  try {
    await connectMongoDB();

    const data = await req.json();

    // Validate required fields
    const { name, email, password, image, provider, currencyCode } = data;

    // hasing the password
    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(process.env.SALT_ROUND || "10"),
    );

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 },
      );
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered. Please use a different email." },
        { status: 409 },
      );
    }

    // Prepare user data with defaults
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      image: image || "",
      provider: provider || "credentials",
      role: "user",
      defaultWorkspaceId: undefined,
    };

    // Create user
    const user = await User.create(userData);
    const currency = getCurrencyByCode(currencyCode);
    const workspace = await Workspace.create({
      name: `Personal Workspace`,
      description: `This is the default workspace for ${user.name}`,
      ownerId: user._id,
      isDefault: true,
      isPersonal: true,
      currency,
    });

    user.defaultWorkspaceId = workspace._id;
    await user.save();

    // Create wallet
    const wallet = await Wallet.create({
      name: `Cash`,
      description: `This is the default wallet for ${user.name}`,
      ownerId: user._id,
      workspaceId: workspace._id,
      isDefault: true,
      type: "cash",
      balance: 0,
      currency: currency.code,
    });

    // create default some category
    const defaultCategories = [
      { name: "Food", type: "expense" },
      { name: "Transport", type: "expense" },
      { name: "Entertainment", type: "expense" },
      { name: "Salary", type: "income" },
      { name: "Freelance", type: "income" },
    ];
    const Categories = await Category.insertMany(
      defaultCategories.map((cat) => ({
        ...cat,
        ownerId: user._id,
        workspaceId: workspace._id,
      })),
    );

    // Return success response without sensitive data
    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
          provider: user.provider,
          role: user.role,
          defaultWorkspaceId: user.defaultWorkspaceId,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Registration error:", error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Email already exists. Please use a different email." },
        { status: 409 },
      );
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message,
      );
      return NextResponse.json({ error: messages.join(", ") }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 },
    );
  }
};
