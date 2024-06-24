const express = require('express');
const zod = require('zod');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const asyncHandler = require('express-async-handler');
const { User, Account } = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

const signupBody = zod.object({
	username: zod.string().email(),
	firstName: zod.string(),
	lastName: zod.string(),
	password: zod.string(),
});

const signinBody = zod.object({
	username: zod.string().email(),
	password: zod.string(),
});

const updateBody = zod.object({
	password: zod.string().optional(),
	firstName: zod.string().optional(),
	lastName: zod.string().optional(),
});

router.post(
	'/signup',
	asyncHandler(async (req, res, next) => {
		const { success } = signupBody.safeParse(req.body);

		if (!success) {
			return res.status(411).json({
				message: 'Incorrect inputs.',
			});
		}

		const existingUser = await User.findOne({
			username: req.body.username,
		});

		if (existingUser) {
			return res.status(411).json({
				message: 'Email already taken.',
			});
		}

		try {
			const newUser = new User({
				username: req.body.username,
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				password: req.body.password,
			});

			await newUser.save();
			const userId = newUser._id;

			await Account.create({
				userId,
				balance: (1 + Math.random() * 10000).toFixed(2),
			});

			const token = jwt.sign({ userId }, JWT_SECRET);

			return res.json({
				message: 'User created successfully.',
				token,
			});
		} catch (err) {
			return res.status(411).json({
				message: 'Error while signing up.',
			});
		}
	})
);

router.post(
	'/signin',
	asyncHandler(async (req, res, next) => {
		const { success } = signinBody.safeParse(req.body);
		if (!success) {
			return res.status(411).send({ message: 'Incorrect inputs.' });
		}

		const user = await User.findOne({ username: req.body.username });
		if (!user) {
			return res.status(411).send({ message: 'User does not exist.' });
		}

		const passwordMatched = req.body.password === user.password;
		if (passwordMatched) {
			const userId = user._id;
			const token = jwt.sign({ userId }, JWT_SECRET);
			return res.status(200).send({ token });
		} else {
			return res.status(411).send({ message: 'Invalid credentials.' });
		}
	})
);

router.put(
	'/',
	authMiddleware,
	asyncHandler(async (req, res) => {
		const { success } = updateBody.safeParse(req.body);

		if (!success) {
			res.status(411).json({ message: 'Error while updating information.' });
		}

		try {
			await User.updateOne({ _id: req.userId }, req.body);

			res.json({
				message: 'Updated Successfully',
			});
		} catch (err) {
			res.status(411).json({ message: 'Error while updating information.' });
		}
	})
);

router.get(
	'/bulk',
	asyncHandler(async (req, res) => {
		const filter = req.query.filter || '';

		const users = await User.find({
			$or: [
				{ firstName: { $regex: filter } },
				{ lastName: { $regex: filter } },
			],
		});

		res.json({
			users: users.map((user) => ({
				username: user.username,
				firstName: user.firstName,
				lastName: user.lastName,
				_id: user._id,
			})),
		});
	})
);

module.exports = router;
