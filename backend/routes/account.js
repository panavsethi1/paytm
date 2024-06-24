const express = require('express');
const asyncHandler = require('express-async-handler');
const { authMiddleware } = require('../middleware');
const { Account } = require('../db');
const { default: mongoose } = require('mongoose');

const router = express.Router();

router.get(
	'/balance',
	authMiddleware,
	asyncHandler(async (req, res) => {
		try {
			const account = await Account.findOne({ userId: req.userId });
			return res.status(200).send({ balance: account.balance });
		} catch (err) {
			return res.status(411).send({ message: 'Error while fetching balance.' });
		}
	})
);

router.post(
	'/transfer',
	authMiddleware,
	asyncHandler(async (req, res) => {
		// try {
		const session = await mongoose.startSession();

		session.startTransaction();
		const { amount, toAccountId } = req.body;

		const account = await Account.findOne({ userId: req.userId }).session(
			session
		);

		if (!account || amount > account.balance) {
			await session.abortTransaction();
			return res.status(411).json({
				message: 'Insufficient balance.',
			});
		}

		const toAccount = await Account.findOne({ userId: toAccountId }).session(
			session
		);

		if (!toAccount) {
			await session.abortTransaction();
			return res.status(400).json({
				message: 'Invalid account.',
			});
		}

		await Account.updateOne(
			{ userId: req.userId },
			{ $inc: { balance: -amount } }
		).session(session);

		await Account.updateOne(
			{ userId: toAccountId },
			{ $inc: { balance: amount } }
		).session(session);

		await session.commitTransaction();

		res.json({
			message: 'Transfer successful',
		});
		// } catch (err) {
		// 	return res
		// 		.status(411)
		// 		.send({ message: 'Error while excuting the transfer.', err });
		// }
	})
);

module.exports = router;
