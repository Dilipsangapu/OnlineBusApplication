package com.OnlineBusBooking.OnlineBus.repository;

import com.OnlineBusBooking.OnlineBus.model.Booking;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface BookingRepository extends MongoRepository<Booking, String> {
    List<Booking> findByBusId(String busId);
    List<Booking> findByCustomerEmail(String email);
    boolean existsByBusIdAndTravelDateAndSeatNumber(String busId, String travelDate, String seatNumber);
    List<Booking> findByBusIdAndTravelDate(String busId, String travelDate);
    List<Booking> findByBusIdIn(List<String> busIds);


}
