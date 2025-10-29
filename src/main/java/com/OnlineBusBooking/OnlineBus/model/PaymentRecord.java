package com.OnlineBusBooking.OnlineBus.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
@Data
@Document(collection = "payments")
public class PaymentRecord {

    @Id
    private String id;

    private String orderId;
    private String paymentId;
    private String receipt;
    private int amount;
    private String status;
    private LocalDateTime timestamp = LocalDateTime.now();

}