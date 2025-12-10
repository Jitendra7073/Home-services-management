const prisma = require("../prismaClient");

const {
  AddressValidation,
} = require("../helper/validation/address.validation");
const { verifyToken } = require("../helper/jwtToken");

// ==================================== USER PROFILE ====================================
const getUserProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
        addresses: true, // include all addresses
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found." });
    }

    return res.status(200).json({
      success: true,
      msg: "User profile fetched successfully.",
      user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch user profile.",
    });
  }
};

const getMe = async (req, res) => {
  const token = req.params.token;
  const user = verifyToken(token);
  if (!token || !user) {
    return res.status(400).json({ success: false, message: "Invalid Token" });
  }
  const userId = user.id;

  try {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
      },
    });
    return res.status(200).json({ success: true, user: userData });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteProfile = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      msg: "User Id is required.",
    });
  }
  try {
    const res = await prisma.user.delete({
      where: { id: userId },
    });
    return res.status(200).json({
      success: true,
      msg: "User deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete user.",
    });
  }
};
// ==================================== ADDRESS ====================================

const getAddress = async (req, res) => {
  const userId = req.user.id;

  try {
    const address = await prisma.Address.findFirst({
      where: { userId },
    });

    return res.status(200).json({
      success: true,
      msg: "Address fetched successfully.",
      address,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch address.",
    });
  }
};

const addAddress = async (req, res) => {
  const userId = req.user.id;
  const { error, value } = AddressValidation.validate(req.body);

  if (error) {
    return res.status(400).send({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }
  try {
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });

    if (isAddressExist) {
      return res.status(400).send({
        success: false,
        msg: "Address already exist.",
      });
    }

    const newAddress = await prisma.Address.create({
      data: { ...value, userId },
    });
    return res.status(201).send({
      success: true,
      msg: "Address created successfully.",
      address: newAddress,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not create address.",
    });
  }
};

const deleteAddress = async (req, res) => {
  const userId = req.user.id;

  try {
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });
    if (!isAddressExist) {
      return res.status(404).send({
        success: false,
        msg: "Address not found.",
      });
    }

    await prisma.Address.delete({
      where: { id: isAddressExist.id },
    });

    return res.status(200).send({
      success: true,
      msg: "Address deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not delete address.",
    });
  }
};

module.exports = {
  getUserProfile,
  addAddress,
  deleteAddress,
  getAddress,
  getMe,
  deleteProfile,
};
