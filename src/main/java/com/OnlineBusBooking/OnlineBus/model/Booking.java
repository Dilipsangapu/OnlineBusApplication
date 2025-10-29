package com.OnlineBusBooking.OnlineBus.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "bookings")
public class Booking {

    @Id
    private String id;

    private String busId;
    private String travelDate;
    private String customerEmail;

    private String seatNumber;
    private String seatType;
    private double fare;

    private String passengerName;
    private int passengerAge;
    private String passengerMobile;

    private String passengerFrom; // ✅ ADDED
    private String passengerTo;   // ✅ ADDED
    private String passengerEmail;
    private String status;


}
