import React from 'react';
import PlacesAutocomplete from 'react-places-autocomplete';
import Head from 'next/head';

import css from '../../styles/vars';
import { withCheckout } from '../hoc';
import { bindToThis, pullInt, uid, AppGlobals, BACS_NOTIF } from '../constants';
import { Paystack, DEBUG } from '../Config';
import { Button, ButtonPane, CheckoutButton, ConfirmOrder, LocationSearchInput, PaystackButton, Section, Sectionizr, View } from '.';
import { Hidden } from './View';

export default class Checkout extends React.PureComponent {
    constructor(props) {
        super(props);
        // form
        const form = {
            'checkout.email': '',
            ...this.props.fieldDefaults,
        };
        
        // except in readonly mode
        if (!props.readonly) {
            // don't remember shipping method
            delete form['shipping.method'];
            form['map.searchbox.update'] = props.location;
        }

        this.state = {
            form: {...form},
            isStorePickup: false,
            isConfirming: false,
            orderType: '',
        };

        // bind
        bindToThis(this, 'actionHandler');
        bindToThis(this, 'setIsStorePickup');
        bindToThis(this, 'doCheckout');
    }
    getShippingMethods() {
        this.actionHandler('get.shipping.methods');
    }
    componentDidMount() {
        this.setIsStorePickup(this.props);
    }
    componentWillReceiveProps(nextProps) {
        this.setIsStorePickup(nextProps);
    }
    setIsStorePickup(props) {
        if (props.readonly) {
            this.setState({isStorePickup: props.fieldDefaults['shipping.method'] == 'flat_rate:51'});
        }
    }
    actionHandler(type, data) {
        switch (type) {
            case 'map.searchbox.update':
                this.props.actionHandler(type, data);
            case 'checkout.clientname':
            case 'checkout.email':
            case 'checkout.phone':
            case 'checkout.note':
            case 'shipping.method':
                let {form} = this.state;
                form[type] = data.value || data;
                this.setState({ form });

                if (type == 'shipping.method') {
                    const isStorePickup = data.value == 'flat_rate:51';
                    this.setState({isStorePickup});
                    
                    let txt = data.options[data.selectedIndex].text;
                    let spl = txt.split(':');
                    
                    this.actionHandler('set.shipping.method', {
                        method: data.value,
                        cost: !isStorePickup? pullInt(spl[spl.length - 1]):0,
                        desc: txt,
                    });
                }
                break;
            case 'checkout.pay':
            case 'checkout.finish':
                this.doCheckout(type, data);
                break;
            case 'checkout.cancel':
                this.actionHandler('toast.show', { msg: "You have cancelled the order" });
                this.props.actionHandler && this.props.actionHandler(type, data);
                break;
            case 'order.holdon':
                this.setState({isConfirming: false});
                break;
            case 'order.confirm':
                this.actionHandler('app.busy');
                this.setState({isConfirming: false});
                this.props.actionHandler && this.props.actionHandler(this.orderType, this.orderData);
                break;
            case 'payment.option':
                this.setState({orderType: data});
                break;
            case 'checkout.do':
                if (!this.state.orderType) this.actionHandler('toast.show', {msg: "Please select your preferred payment method", type: 'w'});
                else {
                    // split intent from payment method id
                    const payment_data = this.state.orderType.split(/\|/);
                    AppGlobals.payment_method = payment_data[1];
                    this.doCheckout(payment_data[0], this.state.form);
                }
                break;
            default:
                this.props.actionHandler && this.props.actionHandler(type, data);
                break;
        }
    }
    doCheckout(type, data) {
        const test = (!this.state.isStorePickup && !data['map.searchbox.update']) || !data['checkout.clientname'] || !data['checkout.email'] || !data['checkout.phone'] || !data['shipping.method'];
        if (test) this.actionHandler('toast.show', {msg: "We need all checkout details to process your order", type: 'w'});
        else {
            this.orderType = type;
            this.orderData = data;
            this.setState({isConfirming: true});
        }
    }
    confirmLocationView() {
        let {props} = this;
        let {fieldDefaults: __} = props;
        const pendingPaymentButtons = <View>
            <Button label="Complete Order" clickHandler={e => {this.actionHandler('checkout.pay', this.state.form);}} />
            &emsp; <Button label="Cancel" clickHandler={e => {this.actionHandler('checkout.cancel', this.state.form);}} />
        </View>;
        const buttons = <View>
            <Hidden>
                <PaystackButton
                    class="btn sleek-btn"
                    reference={uid()}
                    email={this.state.form['checkout.email']}
                    metadata={{
                        "custom_fields":[
                            {
                              "display_name":"Order ID",
                              "variable_name":"Order ID",
                              "value":props.order_id
                            },
                            {
                              "display_name":"Customer Name",
                              "variable_name":"Customer Name",
                              "value":this.state.form['checkout.clientname']
                            },
                            {
                              "display_name":"Phone Number",
                              "variable_name":"Phone Number",
                              "value":this.state.form['checkout.phone']
                            },
                        ]
                    }}
                    amount={props.total * 100}
                    paystackkey={DEBUG? Paystack.TestPublicKey:Paystack.LivePublicKey}
                    ref={btn => this.actionHandler('set.paystack.btn', btn)}
                    callback={response => this.actionHandler('paystack.response', response)}
                    close={response => this.actionHandler('paystack.dismiss', response)}>
                </PaystackButton>
            </Hidden>
            {props.readonly? pendingPaymentButtons:<CheckoutButton actionHandler={this.actionHandler} selected={this.state.orderType} />}
        </View>;
        return (
            <Section>
                <div className="ConfirmLocation">
                    <div className="wrapper">
                        <div className="group">
                            <label className="label">Shipping preference (you can come pickup at our store too)</label>
                            <select
                                name="shipping_method[0]"
                                data-index="0" id="shipping_method_0"
                                className="field fancy-select"
                                defaultValue={props.readonly && __['shipping.method']}
                                onChange={e => this.actionHandler('shipping.method', e.target)}>

                                <option value="" style={{display: 'none'}}>Select Shipping Method</option>
                                <option value="flat_rate:51">Store Pick Up (20 Minutes)</option>
                                <option value="flat_rate:46">Ajah - 2hrs delivery time: ₦1,200.00</option>
                                <option value="flat_rate:45">Igbo efon (6th roundabout) - VGC 1hr30mins: ₦800.00</option>
                                <option value="flat_rate:44">Ikate (3rd roundabout) - Agungi 1hr-1hr 15mins: ₦600.00</option>
                                <option value="flat_rate:42">Ikoyi - 45mins-1hr delivery time: ₦400.00</option>
                                <option value="flat_rate:43">Lekki phase 1 - Marua (2nd roundabout) 45mins - 1hr: ₦400.00</option>
                                <option value="flat_rate:41">Marina &amp; Lagos island - 45mins - 1hr 15mins delivery time: ₦400.00</option>
                                <option value="flat_rate:40">Victoria island - 45mins-1hr delivery time: ₦400.00</option>
                            </select>
                        </div>
                        {!this.state.isStorePickup && <div className="group">
                            <label className="label">Enter delivery address</label>
                            <LocationSearchInput
                                actionHandler={this.actionHandler}
                                location={props.readonly? 
                                    __['map.searchbox.update']:
                                    (__['map.searchbox.update'] || props.location)}>
                                </LocationSearchInput>
                            {/* <input type="text" onChange={e => this.actionHandler('map.searchbox.update', e.target)} placeholder="Where are you located?" /> */}
                        </div>}
                        <div className="group">
                            <label className="label">Your name</label>
                            <input className="field" type="text" defaultValue={__['checkout.clientname']} onChange={e => this.actionHandler('checkout.clientname', e.target)} placeholder="Put your name here" />
                        </div>
                        <div className="group">
                            <label className="label">Email address</label>
                            <input className="field" type="email" defaultValue={__['checkout.email']} onChange={e => this.actionHandler('checkout.email', e.target)} placeholder="Enter your active email address" />
                        </div>
                        <div className="group">
                            <label className="label">Phone</label>
                            <input className="field" type="text" defaultValue={__['checkout.phone']} onChange={e => this.actionHandler('checkout.phone', e.target)} placeholder="Phone number goes here" />
                        </div>
                        <div className="group">
                            <label className="label">Notes (extra information about your order)</label>
                            <textarea className="field" rows="1" defaultValue={__['checkout.note']} onChange={e => this.actionHandler('checkout.note', e.target)} placeholder="What should we note about this order"></textarea>
                        </div>
                        <div className="clearfix"></div>
                        <ButtonPane>
                            {buttons}
                        </ButtonPane>
                    </div>

                    {this.state.isConfirming && <ConfirmOrder price={props.total} actionHandler={this.actionHandler} moreInfo={AppGlobals.payment_method == 'bacs' && BACS_NOTIF} />}
                </div>

                {/* styles */}
                <style jsx>{`
                    .ConfirmLocation {
                        // background: ${css.colors.foreground};
                        height: 100%;
                        overflow: auto;
                        // color: ${css.colors.background};
                        padding: 1rem 2px;
                        // display: flex;
                        // flex: 1,
                    }
                    .wrapper {
                        width: 100%;
                    }
                    .title {
                        font-weight: 100;
                        border-bottom: solid thin #fff;
                        max-width: 360px;
                    }
                    ::placeholder {
                        color: rgba(0, 0, 0, 0.3);
                        font-family: 'Source Sans Pro', sans-serif;
                    }
                    .fancy-select {
                        -webkit-appearance: button;
                    }
                `}</style>
            </Section>
        );
    }
    render() {
        const PriceTag = 
            <div className="PriceTag">
                <h3 className="price-label font-primary slim">Total: {`\u20A6`}{this.props.total}</h3>

                {/* styles */}
                <style jsx>{`
                    .Center {
                        text-align: center;
                    }
                    .PriceTag {
                        background: ${css.colors.touchof};
                        color: ${css.colors.background};
                        position: absolute;
                        padding: 0 2rem;
                        display: inline-block;
                        right: 1rem;
                        top: 0;
                        transition: .5s ease-in-out;
                    }
                    @media screen and (min-width: 720px) {
                        .PriceTag {
                            top: -42px;
                            height: 42px;
                            border-radius: 4px 4px 0 0;
                            filter: drop-shadow(0px -2px 5px rgba(0,0,0,.3));
                        }
                    }
                    @media screen and (max-width: 719px) {
                        .price-label {
                            margin: .5rem 0
                        }
                    }
                `}</style>
            </div>;
        return withCheckout(
            <div className="Checkout">
                {this.confirmLocationView()}
            </div>,
            {
                page_title: 'SmoothieExpress: Checkout',
                section_name: 'checkout',
                section_header: 'Checkout',
                actionHandler: this.actionHandler,
            },
            PriceTag
        );
    }
}