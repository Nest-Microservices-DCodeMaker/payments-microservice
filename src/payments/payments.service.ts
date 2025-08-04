import Stripe from 'stripe';
import { envs, NATS_SERVICE } from 'src/config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(envs.stripeSecret);

  private readonly logger = new Logger('PaymentService');

  constructor(
    @Inject(NATS_SERVICE)
    private readonly client: ClientProxy
  ) { }

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name
        },
        unit_amount: Math.round( item.price * 100 ),
      },
      quantity: item.quantity
    }));

    const session = await this.stripe.checkout.sessions.create({
      // Put orderID
      payment_intent_data: {
        metadata: {
          orderId
        }
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: 'http://localhost:3003/payments/success',
      cancel_url: 'http://localhost:3003/payments/cancel'
    });

    // return session;
    return {
      cancelUrl: session.cancel_url,
      successUrl_: session.success_url,
      url: session.url
    }
  }

  async stripeWebHook( req: Request, res: Response ) {
    const sig = req.headers['stripe-signature'];

    let event: Stripe.Event;
    // Testing
    // const endpointSecret = "whsec_ce9bb7e2187f68fdaf3eb61b1fbe7e496f490954478e30ff718a23369f10c1b4";

    // Real
    const endpointSecret = envs.STRIPE_ENDPOINT_SECRET;
 
    try {
      
      event = this.stripe.webhooks.constructEvent(req['rawBody'], sig!, endpointSecret);

    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    switch(event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;
        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receiptUrl: chargeSucceeded.receipt_url
        }
        this.client.emit('payment.succeeded', payload);
        break;
      
      default:
        console.log(`Event ${ event.type } not handled`)
        break;

    }

    return res.status(200).json({ sig });
  }

}
