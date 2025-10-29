
package com.OnlineBusBooking.OnlineBus.repository;



import com.OnlineBusBooking.OnlineBus.model.PaymentRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PaymentRepository extends MongoRepository<PaymentRecord, String> {
}
