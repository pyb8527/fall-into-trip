package net.weeniebeenie.fit.trip.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CandidateVoteRepository extends JpaRepository<CandidateVote, CandidateVote.Key> {

    /** 후보 여럿의 표를 한 번에. 후보마다 물으면 그 수만큼 질의가 붙습니다. */
    List<CandidateVote> findAllByCandidateIdIn(Collection<String> candidateIds);

    void deleteByCandidateIdAndUserId(String candidateId, String userId);
}
