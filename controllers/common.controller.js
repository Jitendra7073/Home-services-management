const prisma = require("../prismaClient");

const {
  AddressValidation,
} = require("../helper/validation/address.validation");

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

// ==================================== ADDRESS ====================================
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
  console.log("Delete address for user:", userId);

  try {
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });
    console.log("Address found:", isAddressExist);
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
};
