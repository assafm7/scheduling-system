package com.assignment.scheduler.scheduling;

import java.time.Instant;
import java.util.List;

public record PreviewResponse(List<Instant> nextFireTimes) {
}
