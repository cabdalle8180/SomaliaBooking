import bcrypt from "bcrypt";
import User from "../models/users.js";
import  generateToken from "../utils/generateToken.js";
const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  phone: user.phone ?? null,
  role: user.role,
  status: user.status,
});

export const register = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body ?? {};

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      (phone !== undefined && typeof phone !== "string")
    ) {
      return res.status(400).json({ message: "Invalid registration data" });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    if (
      !cleanUsername ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      password.length < 8 ||
      (cleanPhone !== undefined && !cleanPhone)
    ) {
      return res.status(400).json({
        message: "Provide a username, valid email, and password of at least 8 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      role: "customer",
      status: "active",
    });

    return res.status(201).json({
      user: publicUser(user),
      token: generateToken(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Username, email, or phone is already in use",
      });
    }

    console.error("Registration failed:", error);
    return res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is suspended" });
    }

    return res.status(200).json({
      user: publicUser(user),
      token: generateToken(user),
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const getMe = (req, res) => {
  return res.status(200).json({ user: publicUser(req.user) });
};

