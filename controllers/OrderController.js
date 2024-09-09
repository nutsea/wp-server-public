const { Order, OrderItem, Photo, OrderPhoto, Item, User } = require('../models/models')
const ApiError = require('../error/apiError')
const { Op, or } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')
const { Telegraf } = require('telegraf')

//for linux
// const token = '7117696688:AAGBCpe3nQEziMRibTakCm6UjDkUgG7shVs'

// not for linux
// const token = '7441093659:AAFtibz3rhCOdpHZpVC8HOe-YNNuvWNrCpE'

const token = process.env.BOT_TOKEN

const bot = new Telegraf(token)

const messages = {
    // 0: '👨🏻‍💻 Ваш заказ принят в обработку!\n\nОжидайте, мы скоро с Вами свяжемся!',
    0: '👨🏻‍💻 Ваш заказ принят, пожалуйста напишите менеджеру @wear_poizon для уточнения деталей заказа и оплаты.\n\nНомер вашего заказа: ',
    1: '💳 Заказ оплачен!\n\nКак только мы его выкупим, Вам будет доступен отчёт о выкупе в разделе "Мои заказы" на сайте.',
    2: '🧾 Ваш заказ выкуплен!\n\nС подробным отчётом о выкупе Вы сможете ознакомиться в разделе "Мои заказы" на сайте.',
    4: '🖼 Ваш фото отчёт!\n\nМы получили Ваш заказ на нашем складе в Китае и сделали для Вас фото отчёт! Ознакомиться с фотографиями заказа Вы сможете в разделе "Мои заказы" на сайте.',
    6: '🚛 Выезжаем из Китая!\n\nВаш заказ выехал со склада в Китае и направляется в Россию.',
    7: '📍 Ваш заказ в России!\n\nЗаказ приехал в Россию и совсем скоро будет передан в СДЭК. Ожидайте, скоро мы отправим трек-код для отслеживания. Найти его Вы сможете в разделе "Мои заказы" на сайте.',
    8: '📦 Ваш заказ передан в СДЭК!\n\nУже выслали вам трек-номер для отслеживания, найти его Вы сможете в разделе "Мои заказы" на сайте.',
    9: '💜 Спасибо за заказ!\n\nВидим, что Вы его забрали и надеемся, что Вам всё понравилось! Оставьте пожалуйста отзыв в ВК отзывах 👉🏼 vk.com/reviews-218074236\n\nИ если не затруднит продублируйте здесь пожалуйста 👉🏼 vk.com/topic-218074236_48983779\n\nБлагодарим заранее 🫶🏼',
    notReview: '💜 Спасибо за заказ!\n\nВидим, что Вы его забрали и надеемся, что Вам всё понравилось!'
}

class OrderController {
    async create(req, res, next) {
        try {
            const { name, social_media, checked_price, recipient, phone, address, ship_type, delivery_cost, is_split, course, fee, cost, discount_cost, discount, promo_code, items } = req.body
            const first_pay = is_split ? Math.ceil(cost / 2) : cost
            const second_pay = is_split ? Math.ceil(cost / 2) : 0
            const client = await User.findOne({ where: { id: req.user.id } })
            const order = await Order.create({ name: client.name + ' ' + client.surname, social_media, social_media_type: 'Telegram', checked_price, recipient, phone, address, ship_type, delivery_cost: delivery_cost * items.length, is_split, first_pay, second_pay, course, fee: fee * items.length, cost, discount_cost, discount, promo_code, client_id: req.user.id })
            for (let i of items) {
                await Photo.findOne({ where: { item_uid: i.item_uid } }).then(async data => {
                    await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                        item.orders = item.orders + 1
                        await item.save()
                        await OrderItem.create({
                            item_uid: i.item_uid,
                            name: i.name,
                            img: data.img,
                            category: item.category,
                            model: item.model ? item.model : '',
                            size: i.size,
                            ship: i.ship,
                            cny_cost: i.cny_cost,
                            rub_cost: Math.ceil(i.rub_cost),
                            order_id: order.id,
                            fee: i.fee,
                            delivery_cost: i.delivery_cost
                        })
                    })
                })
            }
            // const client = await User.findOne({ where: { id: req.user.id } })
            bot.telegram.sendMessage(client.chat_id, messages[0] + order.id)
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async createByAdmin(req, res, next) {
        try {
            const { name, surname, social_media, recipient, phone, address, ship_type, is_split, first_pay, second_pay, first_paid, second_paid, paid, course, cost, discount, promo_code, comment, can_review, status, items, social_media_type, client_id } = req.body
            let fee = items.map(i => i.fee).reduce((a, b) => a + b)
            let delivery_cost = items.map(i => i.delivery_cost).reduce((a, b) => a + b)
            let order
            let formatPhone = phone.replace(/\D+/g, '')
            if (formatPhone[0] === '8') formatPhone = '7' + formatPhone.slice(1)
            order = await Order.create({ name, surname, social_media, recipient, phone: formatPhone, address, ship_type, delivery_cost: Number(delivery_cost), is_split, first_pay: Number(first_pay), second_pay: Number(second_pay), first_paid, second_paid, paid: paid ? paid : 0, course, fee: Number(fee), cost: Number(cost), discount_cost: Number(cost) - Number(discount), discount: Number(discount), promo_code, comment, can_review, status, social_media_type, client_id })
            // if (client_id) {
            // } else {
            //     const client = await User.create({ name, surname, phone })
            //     order = await Order.create({ name, surname, social_media, recipient, phone, address, ship_type, delivery_cost: Number(delivery_cost), is_split, first_pay: Number(first_pay), second_pay: Number(second_pay), first_paid, second_paid, paid: paid ? paid : 0, course, fee: Number(fee), cost: Number(cost), discount_cost: Number(cost) - Number(discount), discount: Number(discount), promo_code, comment, can_review, status, social_media_type, client_id: client.id })
            // }
            for (let i of items) {
                await Item.findOne({ where: { item_uid: i.item_uid } }).then(async item => {
                    await OrderItem.create({
                        item_uid: i.item_uid,
                        name: i.name,
                        img: i.img,
                        category: item.category,
                        size: i.size,
                        ship: i.ship,
                        cny_cost: Number(i.cny_cost),
                        rub_cost: Math.ceil(Number(i.cny_cost) * course),
                        order_id: order.id,
                        fee: Number(i.fee),
                        delivery_cost: Number(i.delivery_cost)
                    })
                })
            }
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getIn(req, res, next) {
        try {
            const { search } = req.query
            const orders = await Order.findAll({
                where: {
                    status: 0,
                    ...(search && {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${search}%` } },
                            { recipient: { [Op.iLike]: `%${search}%` } },
                            { phone: { [Op.iLike]: `%${search}%` } },
                            { address: { [Op.iLike]: `%${search}%` } },
                        ]
                    })
                }
            })
            for (let i of orders) {
                await OrderItem.findAll({ where: { order_id: i.id } }).then(data => {
                    if (data.length > 0) {
                        i.dataValues.items = data
                        i.dataValues.ship = data[0].ship
                    }
                })
            }
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getAll(req, res, next) {
        try {
            const { search, statuses } = req.query
            const orders = await Order.findAll({
                where: {
                    status: { [Op.in]: statuses },
                    ...(search && {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${search}%` } },
                            { social_media: { [Op.iLike]: `%${search}%` } },
                            { recipient: { [Op.iLike]: `%${search}%` } },
                            { phone: { [Op.iLike]: `%${search}%` } },
                            { address: { [Op.iLike]: `%${search}%` } },
                            { ship_type: { [Op.iLike]: `%${search}%` } },
                            { promo_code: { [Op.iLike]: `%${search}%` } }
                        ]
                    })
                }
            })
            for (let i of orders) {
                await OrderItem.findAll({ where: { order_id: i.id } }).then(data => {
                    i.dataValues.items = data
                    i.dataValues.ship = data[0].ship
                })
            }
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOne(req, res, next) {
        try {
            const { id } = req.query
            const order = await Order.findOne({ where: { id } })
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getClientOrders(req, res, next) {
        try {
            const orders = await Order.findAll({ where: { client_id: req.user.id } })
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getUserOrders(req, res, next) {
        try {
            const { id } = req.query
            const orders = await Order.findAll({ where: { client_id: id } })
            return res.json(orders)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderItems(req, res, next) {
        try {
            const { id } = req.query
            const items = await OrderItem.findAll({ where: { order_id: id } })
            return res.json(items)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderReport(req, res, next) {
        try {
            const { id, type } = req.query
            const report = await OrderPhoto.findAll({ where: { order_id: id, type } })
            return res.json(report)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async getOrderPhotos(req, res, next) {
        try {
            const { id } = req.query
            const report = await OrderPhoto.findAll({ where: { order_id: id } })
            return res.json(report)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateStatus(req, res, next) {
        try {
            const { id, status } = req.body
            const order = await Order.findOne({ where: { id } })

            const orderItems = await OrderItem.findAll({ where: { order_id: id } })
            const orderPhotosBuy = await OrderPhoto.findAll({ where: { order_id: id, type: 'buy' } })
            const orderPhotosStock = await OrderPhoto.findAll({ where: { order_id: id, type: 'stock' } })


            let allow = true
            switch (status) {
                case 1:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 2:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 2) allow = false
                        if (!i.order_num) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 3:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 3) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 4:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 5:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 6:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 7:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 8:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 9:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 10:
                    order.status = status
                    break

                case 11:
                    order.status = status
                    break

                default:
                    break
            }
            await order.save()
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateOrderItems(req, res, next) {
        try {
            const { idArr, statuses, orderNums, trackNums, pricesCNY, pricesRUB, fees, deliveries } = req.body
            for (let i = 0; i < idArr.length; i++) {
                const item = await OrderItem.findOne({ where: { id: idArr[i] } })
                item.status = statuses[i] ? statuses[i] : item.status
                item.order_num = orderNums[i] ? orderNums[i] : item.order_num
                item.track = trackNums[i] ? trackNums[i] : item.track
                // const order = await Order.findOne({ where: { id: item.order_id } })
                // if (pricesRUB[i]) {
                //     order.cost = Number(order.cost) - Number(item.rub_cost) + Number(pricesRUB[i])
                //     order.cost = Math.ceil(order.cost)
                // }
                // if (pricesCNY[i]) {
                //     order.discount_cost = Number(order.discount_cost) - Number(item.rub_cost) + Number(pricesRUB[i])
                //     order.discount_cost = Math.ceil(order.discount_cost)
                // }
                // if (fees && fees[i]) {
                //     order.fee = Number(order.fee) - Number(item.fee) + Number(fees[i])
                //     order.fee = Math.ceil(order.fee)
                //     order.cost = Number(order.cost) - Number(item.fee) + Number(fees[i])
                //     order.cost = Math.ceil(order.cost)
                //     order.discount_cost = Number(order.discount_cost) - Number(item.fee) + Number(fees[i])
                //     order.discount_cost = Math.ceil(order.discount_cost)
                // }
                // if (deliveries && deliveries[i]) {
                //     order.delivery_cost = Number(order.delivery_cost) - Number(item.delivery_cost) + Number(deliveries[i])
                //     order.delivery_cost = Math.ceil(order.delivery_cost)
                //     order.cost = Number(order.cost) - Number(item.delivery_cost) + Number(deliveries[i])
                //     order.cost = Math.ceil(order.cost)
                //     order.discount_cost = Number(order.discount_cost) - Number(item.delivery_cost) + Number(deliveries[i])
                //     order.discount_cost = Math.ceil(order.discount_cost)
                // }
                item.cny_cost = pricesCNY[i] ? pricesCNY[i] : item.cny_cost
                item.rub_cost = pricesRUB[i] ? pricesRUB[i] : item.rub_cost
                item.rub_cost = Math.ceil(item.rub_cost)
                item.fee = fees && fees[i] ? fees[i] : item.fee
                item.fee = Math.ceil(item.fee)
                item.delivery_cost = deliveries && deliveries[i] ? deliveries[i] : item.delivery_cost
                item.delivery_cost = Math.ceil(item.delivery_cost)
                // await order.save()
                await item.save()
            }
            return res.json({ message: 'Позиции обновлены' })
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async updateOrder(req, res, next) {
        try {
            const { id, status, recipient, phone, ship_type, comment, address, track, cdekTrack, dimensions, cargo_cost, sdek_cost, first_pay, second_pay, firstPaid, secondPaid, paid, canReview, fee, cost, social_media_type, social_media, delivery_cost } = req.body
            const order = await Order.findOne({ where: { id } })
            order.recipient = recipient ? recipient : order.recipient
            order.phone = phone ? phone : order.phone
            order.ship_type = ship_type ? ship_type : order.ship_type
            order.comment = comment ? comment : order.comment
            order.address = address ? address : order.address
            order.track = track ? track : order.track
            order.sdek_track = cdekTrack ? cdekTrack : order.sdek_track
            order.dimensions = dimensions ? dimensions : order.dimensions
            order.cargo_cost = cargo_cost ? cargo_cost : order.cargo_cost
            order.sdek_cost = sdek_cost ? sdek_cost : order.sdek_cost
            order.first_pay = first_pay ? first_pay : order.first_pay
            order.second_pay = second_pay ? second_pay : order.second_pay
            order.first_paid = firstPaid !== undefined ? firstPaid : order.first_paid
            order.second_paid = secondPaid !== undefined ? secondPaid : order.second_paid
            order.paid = paid ? paid : order.paid
            order.can_review = canReview !== undefined ? canReview : order.can_review
            order.fee = fee ? fee : order.fee
            order.cost = cost ? cost : order.cost
            order.discount_cost = cost ? cost - order.discount : order.discount_cost
            order.social_media_type = social_media_type ? social_media_type : order.social_media_type
            order.social_media = social_media ? social_media : order.social_media
            order.delivery_cost = delivery_cost ? delivery_cost : order.delivery_cost
            let allow = true

            const orderItems = await OrderItem.findAll({ where: { order_id: id } })
            const orderPhotosBuy = await OrderPhoto.findAll({ where: { order_id: id, type: 'buy' } })
            const orderPhotosStock = await OrderPhoto.findAll({ where: { order_id: id, type: 'stock' } })
            const client = await User.findOne({ where: { id: order.client_id } })

            switch (status) {
                case 1:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (allow) {
                        if (order.status !== status && client && client.chat_id) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 2:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 2) allow = false
                        if (!i.order_num) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 3:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 3) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 4:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 5:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 6:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 7:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 8:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            bot.telegram.sendMessage(client.chat_id, messages[status])
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 9:
                    if (order.is_split && !order.first_paid) allow = false
                    if (order.is_split && !order.second_paid) allow = false
                    if (order.paid === 0) allow = false
                    if (!order.delivery_cost) allow = false
                    if (!order.sdek_track) allow = false
                    if (!order.dimensions) allow = false
                    if (!order.sdek_cost) allow = false
                    if (!order.track) allow = false
                    for (let i of orderItems) {
                        if (i.status !== 4) allow = false
                        if (!i.order_num) allow = false
                        if (!i.track) allow = false
                    }
                    if (orderPhotosBuy.length === 0) allow = false
                    if (orderPhotosStock.length === 0) allow = false
                    if (allow) {
                        if (order.status !== status) {
                            if (order.can_review) {
                                bot.telegram.sendMessage(client.chat_id, messages[status])
                            } else {
                                bot.telegram.sendMessage(client.chat_id, messages.notReview)
                            }
                        }
                        order.status = status
                        order.checked_price = true
                        if (!order.manager) order.manager = req.user.id
                    }
                    break

                case 10:
                    order.status = status
                    break

                case 11:
                    order.status = status
                    break

                default:
                    break
            }
            await order.save()
            return res.json(order)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async setOrderPhoto(req, res, next) {
        try {
            const { id, type } = req.body
            const { img } = req.files
            let fileName = uuidv4() + ".jpg"
            img.mv(path.resolve(__dirname, '..', 'static', fileName))
            const photo = await OrderPhoto.create({ img: fileName, type, order_id: id })
            return res.json(photo)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }

    async addItemToOrder(req, res, next) {
        try {
            const { id, item_uid, img, name, category, size, ship, cny_cost, rub_cost, delivery_cost, fee } = req.body
            const order = await Order.findOne({ where: { id } })
            const item = await OrderItem.create({ item_uid, img, name, category, size, ship, cny_cost, rub_cost, order_id: order.id })
            order.delivery_cost = Number(order.delivery_cost) + Number(delivery_cost)
            order.delivery_cost = Math.ceil(order.delivery_cost)
            order.fee = Number(order.fee) + Number(fee)
            order.fee = Math.ceil(order.fee)
            order.cost = Number(order.cost) + Number(rub_cost) + Number(delivery_cost) + Number(fee)
            order.cost = Math.ceil(order.cost)
            order.discount_cost = Number(order.discount_cost) + Number(rub_cost) + Number(delivery_cost) + Number(fee)
            order.discount_cost = Math.ceil(order.discount_cost)
            await order.save()
            return res.json(item)
        } catch (e) {
            console.log(e)
            return next(ApiError.badRequest(e.message))
        }
    }
}

module.exports = new OrderController()