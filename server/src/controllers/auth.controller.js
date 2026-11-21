const prisma = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { withISTDisplay } = require('../utils/date');

/**
 * Register a new User & Customer account
 * Default role is CUSTOMER. Admins can create other roles if needed.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user account with this email already exists.',
      });
    }

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Only allow setting AGENT or ADMIN if requester is authenticated as ADMIN
    let userRole = 'CUSTOMER';
    if (role && ['ADMIN', 'AGENT'].includes(role)) {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only Administrators can assign AGENT or ADMIN roles.',
        });
      }
      userRole = role;
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: userRole,
        },
      });

      let customerRecord = null;
      if (userRole === 'CUSTOMER') {
        // Find existing customer by email or create new customer
        customerRecord = await tx.customer.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (customerRecord) {
          customerRecord = await tx.customer.update({
            where: { id: customerRecord.id },
            data: { userId: user.id, phone: phone || customerRecord.phone },
          });
        } else {
          customerRecord = await tx.customer.create({
            data: {
              name,
              email: email.toLowerCase(),
              phone: phone || null,
              userId: user.id,
            },
          });
        }
      }

      return { user, customer: customerRecord };
    });

    // Generate JWT token
    const token = generateToken({
      userId: newUser.user.id,
      email: newUser.user.email,
      role: newUser.user.role,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: newUser.user.id,
        name: newUser.user.name,
        email: newUser.user.email,
        role: newUser.user.role,
        customerId: newUser.customer?.id || null,
        createdAt: newUser.user.createdAt,
        createdAtIST: withISTDisplay({ createdAt: newUser.user.createdAt }).createdAtIST,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login with email and password
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        customer: {
          select: { id: true, phone: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customer?.id || null,
        createdAt: user.createdAt,
        createdAtIST: withISTDisplay({ createdAt: user.createdAt }).createdAtIST,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user details
 */
async function getMe(req, res, next) {
  try {
    res.status(200).json({
      success: true,
      user: withISTDisplay(req.user),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
};
