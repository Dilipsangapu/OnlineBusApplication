package com.OnlineBusBooking.OnlineBus.controller;

import com.OnlineBusBooking.OnlineBus.model.PaymentRecord;
import com.OnlineBusBooking.OnlineBus.repository.PaymentRepository;
import com.OnlineBusBooking.OnlineBus.service.RazorpayService;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin("http://127.0.0.1:5500")
public class PaymentController {

    @Autowired
    private RazorpayService razorpayService;
    @Autowired
    private PaymentRepository paymentRepository;

    @PostMapping("/create-order")
    public ResponseEntity<String> createOrder(@RequestParam int amount, @RequestParam String currency) {
        try {
            RazorpayClient razorpay = new RazorpayClient("rzp_test_38I5IEufjhiOFj", "XCrXx93If1q1cuILOpXcggmb");

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amount); // amount in paise
            orderRequest.put("currency", currency);
            orderRequest.put("receipt", "order_rcptid_11");
            orderRequest.put("payment_capture", true);

            Order order = razorpay.orders.create(orderRequest);
            return ResponseEntity.ok(order.toString());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
    @PostMapping("/save-success")
    public ResponseEntity<String> savePayment(@RequestBody Map<String, Object> data) {
        try {
            PaymentRecord record = new PaymentRecord();
            record.setOrderId((String) data.get("orderId"));
            record.setPaymentId((String) data.get("paymentId"));
            record.setReceipt((String) data.get("receipt"));
            record.setAmount((int) data.get("amount"));
            record.setStatus((String) data.get("status"));
            paymentRepository.save(record);
            return ResponseEntity.ok("✅ Payment saved to MongoDB.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("❌ Error saving payment.");
        }
    }


}