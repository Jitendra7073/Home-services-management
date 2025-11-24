const prisma = require("../prismaClient");

const { AddressValidation } = require("../helper/validation/address.validation");
// ADD ADDRESS
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
            data: { ...value, userId }
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
}

// DELETE ADDRESS 
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
    // ADDRESS
    addAddress,
    deleteAddress,
}