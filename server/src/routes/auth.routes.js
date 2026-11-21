const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth');
const { validateRegister, validateLogin } = require('../middlewares/validator');

router.post('/register', optionalAuthenticate, validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
