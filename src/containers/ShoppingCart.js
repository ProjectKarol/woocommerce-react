import React from 'react'
import {Cart} from '../stores'
import { CartIcon, OrderList, View } from '../components'
import {bindToThis, kformat} from '../constants'

const NEUTRAL = 0
const ORDER_PREVIEW = 1
const PICK_LOCATION = 2

export default class ShoppingCart extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            isEmpty: Cart.isEmpty(),
            total: Cart.getTotal(),
            state: NEUTRAL,
        }

        // bind
        bindToThis(this, 'updateState')
        bindToThis(this, 'closeCart')
        bindToThis(this, 'openCart')
        bindToThis(this, 'actionHandler')
    }
    componentWillMount() {
        Cart.on('order.*', this.updateState)
    }
    componentWillUnmount() {
        Cart.off('order.*', this.updateState)
    }
    updateState() {
        this.setState({
            isEmpty: Cart.isEmpty(),
            total: Cart.getTotal(),
        })
    }
    actionHandler(type, data) {
        switch (type) {
            case 'order.checkout.pick_location':
                this.pickLocation()
                break;
            case 'cart.dismiss':
                this.closeCart()
                break;
        }
    }
    openCart() {
        this.setState({
            state: ORDER_PREVIEW
        })
    }
    closeCart() {
        this.setState({
            state: NEUTRAL
        })
    }
    pickLocation() {
        this.setState({
            state: PICK_LOCATION
        })
        console.log('pick location')
    }
    render() {
        let view = null
        switch (this.state.state) {
            case ORDER_PREVIEW:
                view = <View>
                        <OrderList items={Cart.getAllOrders()}
                            actionHandler={this.actionHandler} />
                        <div className="blankette"></div>

                        {/* styles */}
                        <style jsx>{`
                            @media screen and (min-width: 500px) {
                                .blankette {
                                    height: 60vh;
                                }
                            }
                        `}</style>
                    </View>
                break;
            default:
                view = !this.state.isEmpty?
                    <CartIcon clickHandler={this.openCart} total={kformat(this.state.total)} />:null
                break;
        }
        return <div className="ShoppingCart">{view}</div>
    }
}