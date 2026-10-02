package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DateAnswerRepository extends JpaRepository<DateAnswer, DateAnswerId> {

    List<DateAnswer> findAllByIdOptionIdIn(Collection<String> optionIds);
}
