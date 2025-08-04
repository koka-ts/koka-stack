import * as Err from 'koka/err'
import * as Optic from 'koka-optic'
import * as Store from '../src/koka-store.ts'

type UserEntity = {
    id: string
    name: string
    orderIds: string[]
}

type OrderEntity = {
    id: string
    userId: string
    productIds: string[]
}

type ProductEntity = {
    id: string
    name: string
    price: number
    collectorIds: string[]
}

type RootState = {
    users: Record<string, UserEntity>
    orders: Record<string, OrderEntity>
    products: Record<string, ProductEntity>
}

class UserStorageDomain<Root extends RootState> extends Store.Domain<Root['users'], Root> {
    constructor() {
        super(Optic.root<Root>().prop('users'))
    }
    *getUser(id: string) {
        const users = yield* Store.get(this)
        if (id in users) {
            return users[id]
        }
        class DomainErr extends Err.Err('DomainErr')<string> {}
        throw yield* Err.throw(new DomainErr(`User ${id} not found`))
    }
    *addUser(user: UserEntity) {
        const users = yield* Store.get(this)
        if (user.id in users) {
            class DomainErr extends Err.Err('DomainErr')<string> {}
            throw yield* Err.throw(new DomainErr(`User ${user.id} exists`))
        }
        yield* Store.set(this, { ...users, [user.id]: user })
    }
    *addOrder(userId: string, orderId: string) {
        const user = yield* this.getUser(userId)
        yield* Store.set(this, {
            ...(yield* Store.get(this)),
            [userId]: {
                ...user,
                orderIds: [...user.orderIds, orderId],
            },
        })
    }
}

class OrderStorageDomain<Root extends RootState> extends Store.Domain<Root['orders'], Root> {
    constructor() {
        super(Optic.root<Root>().prop('orders'))
    }
    *getOrder(id: string) {
        const orders = yield* Store.get(this)
        if (id in orders) {
            return orders[id]
        }
        class DomainErr extends Err.Err('DomainErr')<string> {}
        throw yield* Err.throw(new DomainErr(`Order ${id} not found`))
    }
    *addOrder(order: OrderEntity) {
        const orders = yield* Store.get(this)
        if (order.id in orders) {
            class DomainErr extends Err.Err('DomainErr')<string> {}
            throw yield* Err.throw(new DomainErr(`Order ${order.id} exists`))
        }
        yield* Store.set(this, { ...orders, [order.id]: order })
    }
    *addProduct(orderId: string, productId: string) {
        const order = yield* this.getOrder(orderId)
        yield* Store.set(this, {
            ...(yield* Store.get(this)),
            [orderId]: {
                ...order,
                productIds: [...order.productIds, productId],
            },
        })
    }
}

class ProductStorageDomain<Root extends RootState> extends Store.Domain<Root['products'], Root> {
    constructor() {
        super(Optic.root<Root>().prop('products'))
    }
    *getProduct(id: string) {
        const products = yield* Store.get(this)
        if (id in products) {
            return products[id]
        }
        class DomainErr extends Err.Err('DomainErr')<string> {}
        throw yield* Err.throw(new DomainErr(`Product ${id} not found`))
    }
    *addProduct(product: ProductEntity) {
        const products = yield* Store.get(this)
        if (product.id in products) {
            class DomainErr extends Err.Err('DomainErr')<string> {}
            throw yield* Err.throw(new DomainErr(`Product ${product.id} exists`))
        }
        yield* Store.set(this, { ...products, [product.id]: product })
    }
    *getCollectors(productId: string) {
        const product = yield* this.getProduct(productId)
        const users = [] as UserEntity[]
        for (const collectorId of product.collectorIds) {
            const user = yield* new UserStorageDomain().getUser(collectorId)
            users.push(user)
        }
        return users
    }
}

const userStorage = new UserStorageDomain()
const orderStorage = new OrderStorageDomain()
const productStorage = new ProductStorageDomain()

describe('Graph Domain Operations', () => {
    let store: Store.Store<RootState>

    beforeEach(() => {
        const initialState: RootState = {
            users: {
                user1: {
                    id: 'user1',
                    name: 'John Doe',
                    orderIds: ['order1'],
                },
            },
            orders: {
                order1: {
                    id: 'order1',
                    userId: 'user1',
                    productIds: ['product1'],
                },
            },
            products: {
                product1: {
                    id: 'product1',
                    name: 'iPhone',
                    price: 999,
                    collectorIds: ['user1'],
                },
            },
        }
        store = new Store.Store<RootState>({ state: initialState })
    })

    describe('User Operations', () => {
        it('should get user', () => {
            const result = store.runCommand(userStorage.getUser('user1'))
            if (result.type === 'err') throw new Error('Expected user but got error')
            expect(result.value.name).toBe('John Doe')
        })

        it('should add user', () => {
            const newUser = {
                id: 'user2',
                name: 'Jane Doe',
                orderIds: [],
            }
            store.runCommand(userStorage.addUser(newUser))

            const result = store.runCommand(userStorage.getUser('user2'))
            if (result.type === 'err') throw new Error('Expected user but got error')
            expect(result.value.name).toBe('Jane Doe')
        })
    })

    describe('Order Operations', () => {
        it('should get order', () => {
            const result = store.runCommand(orderStorage.getOrder('order1'))
            if (result.type === 'err') throw new Error('Expected order but got error')
            expect(result.value.userId).toBe('user1')
        })

        it('should add product to order', () => {
            store.runCommand(
                productStorage.addProduct({
                    id: 'product2',
                    name: 'MacBook',
                    price: 1999,
                    collectorIds: [],
                }),
            )

            store.runCommand(orderStorage.addProduct('order1', 'product2'))

            const result = store.runCommand(orderStorage.getOrder('order1'))
            if (result.type === 'err') throw new Error('Expected order but got error')
            expect(result.value.productIds).toEqual(['product1', 'product2'])
        })
    })

    describe('Product Operations', () => {
        it('should get product', () => {
            const result = store.runCommand(productStorage.getProduct('product1'))
            if (result.type === 'err') throw new Error('Expected product but got error')
            expect(result.value.name).toBe('iPhone')
        })

        it('should get collectors', () => {
            const result = store.runCommand(productStorage.getCollectors('product1'))
            if (result.type === 'err') throw new Error('Expected collectors but got error')
            expect(result.value.length).toBe(1)
            expect(result.value[0].name).toBe('John Doe')
        })
    })

    describe('Graph Relationships', () => {
        it('should maintain user-order relationship', () => {
            store.runCommand(
                orderStorage.addOrder({
                    id: 'order2',
                    userId: 'user1',
                    productIds: [],
                }),
            )

            store.runCommand(userStorage.addOrder('user1', 'order2'))

            const userResult = store.runCommand(userStorage.getUser('user1'))
            if (userResult.type === 'err') throw new Error('Expected user but got error')
            expect(userResult.value.orderIds).toEqual(['order1', 'order2'])
        })
    })
})
