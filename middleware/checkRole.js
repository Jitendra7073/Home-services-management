const prisma = require("../prismaClient");

const checkUserRole =  () => {
    return async (req, res, next) => {

        const user = await prisma.user.findUnique({
            where: { id : req.user.id }
        })


        if (user.role != "provider") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only service providers can perform this action.",
            });
        }
        return next()

    }
}


module.exports = { checkUserRole };
