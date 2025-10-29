package com.OnlineBusBooking.OnlineBus.service;


import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RazorpayService {

//     @Value("${razorpay.api.key}")
//    private String apiKey ;
//
//    @Value("${razorpay.api.secret}")
//    private String apiSecret ;
//
//    public String createOrder(int amount , String currency , String receiptId) throws RazorpayException {
//        RazorpayClient razorpayClient = new RazorpayClient(apiKey,apiSecret);
//        JSONObject orderRequest  = new JSONObject();
//        orderRequest.put("amount", amount *100);
//        orderRequest.put("currency",currency);
//        orderRequest.put("receipt", receiptId);
//
//        Order order = razorpayClient.orders.create(orderRequest);
//        return order.toString();
//    }

    @Value("${razorpay.api.key}")
    private String apiKey;

    @Value("${razorpay.api.secret}")
    private String apiSecret;

    public String createOrder(int amount, String currency, String receiptId) throws RazorpayException {
        RazorpayClient razorpayClient = new RazorpayClient(apiKey, apiSecret);
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amount * 100);  // Razorpay accepts amount in paise (1 INR = 100 paise)
        orderRequest.put("currency", currency);
        orderRequest.put("receipt", receiptId);

        Order order = razorpayClient.orders.create(orderRequest);
        return order.toString();  // Return order details as JSON string
    }


}