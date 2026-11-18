package com.assignment.scheduler.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.assignment.scheduler.common.ConflictException;
import com.assignment.scheduler.common.NotFoundException;
import com.assignment.scheduler.common.ValidationException;
import com.assignment.scheduler.quartz.JobState;
import com.assignment.scheduler.quartz.QuartzJobManager;
import com.assignment.scheduler.quartz.TriggerFactory;
import com.assignment.scheduler.scheduling.schedule.CronSchedule;
import com.assignment.scheduler.scheduling.schedule.IntervalSchedule;
import com.assignment.scheduler.scheduling.schedule.IntervalUnit;
import com.assignment.scheduler.task.ParameterValidator;
import com.assignment.scheduler.task.TaskRegistry;
import com.assignment.scheduler.task.impl.LogTask;

class SchedulingServiceTest {

	private static final Instant NOW = Instant.parse("2026-01-05T10:00:00Z");

	private static final IntervalSchedule EVERY_5_MIN = new IntervalSchedule(5, IntervalUnit.MINUTES, "UTC");

	private final SchedulingRepository repository = mock(SchedulingRepository.class);

	private final QuartzJobManager jobManager = mock(QuartzJobManager.class);

	private SchedulingService service;

	@BeforeEach
	void setUp() {
		service = new SchedulingService(repository, new TaskRegistry(List.of(new LogTask())), new ParameterValidator(),
				new TriggerFactory(Clock.fixed(NOW, ZoneOffset.UTC)), jobManager);
		when(jobManager.state(any())).thenReturn(new JobState(SchedulingStatus.ACTIVE, NOW.plusSeconds(300)));
	}

	@Test
	void createPersistsThenSchedules() {
		SchedulingResponse response = service.create(request("  Ping  ", Map.of("message", "hi"), EVERY_5_MIN, null));

		ArgumentCaptor<Scheduling> saved = ArgumentCaptor.forClass(Scheduling.class);
		verify(repository).saveAndFlush(saved.capture());
		verify(jobManager).schedule(saved.getValue());
		assertThat(saved.getValue().getName()).isEqualTo("Ping");
		assertThat(saved.getValue().getParameters()).containsEntry("message", "hi");
		assertThat(response.taskName()).isEqualTo("Log message");
		assertThat(response.status()).isEqualTo(SchedulingStatus.ACTIVE);
		assertThat(response.nextFireTime()).isEqualTo(NOW.plusSeconds(300));
		assertThat(response.enabled()).isTrue();
	}

	@Test
	void createReportsAllErrorsAtOnceAndTouchesNothing() {
		assertThatThrownBy(() -> service.create(
				request("x", Map.of("bogus", 1), new CronSchedule("* * * * * ?", "UTC"), null)))
			.isInstanceOfSatisfying(ValidationException.class, ex -> assertThat(ex.getErrors())
				.containsOnlyKeys("parameters.bogus", "parameters.message", "schedule.expression"));

		verifyNoInteractions(repository);
		verify(jobManager, never()).schedule(any());
	}

	@Test
	void createRejectsUnknownTask() {
		SchedulingRequest request = new SchedulingRequest("x", null, "NOPE", Map.of(), EVERY_5_MIN, true, null);

		assertThatThrownBy(() -> service.create(request)).isInstanceOfSatisfying(ValidationException.class,
				ex -> assertThat(ex.getErrors()).containsEntry("taskKey", "is not a known task"));
	}

	@Test
	void updateAppliesChangesAndReschedules() {
		Scheduling existing = existing(2L);
		when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));

		service.update(existing.getId(), request("Renamed", Map.of("message", "new"), EVERY_5_MIN, 2L));

		assertThat(existing.getName()).isEqualTo("Renamed");
		assertThat(existing.getParameters()).containsEntry("message", "new");
		verify(repository).saveAndFlush(existing);
		verify(jobManager).schedule(existing);
	}

	@Test
	void updateWithStaleVersionConflicts() {
		Scheduling existing = existing(3L);
		when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));

		assertThatThrownBy(() -> service.update(existing.getId(), request("x", Map.of("message", "m"), EVERY_5_MIN, 2L)))
			.isInstanceOf(ConflictException.class);
		verify(jobManager, never()).schedule(any());
	}

	@Test
	void updateRequiresVersion() {
		Scheduling existing = existing(0L);
		when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));

		assertThatThrownBy(() -> service.update(existing.getId(), request("x", Map.of("message", "m"), EVERY_5_MIN, null)))
			.isInstanceOfSatisfying(ValidationException.class,
					ex -> assertThat(ex.getErrors()).containsKey("version"));
	}

	@Test
	void missingSchedulingIsNotFound() {
		UUID id = UUID.randomUUID();
		when(repository.findById(id)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
		assertThatThrownBy(() -> service.delete(id)).isInstanceOf(NotFoundException.class);
	}

	@Test
	void deleteRemovesJobAndRow() {
		Scheduling existing = existing(0L);
		when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));

		service.delete(existing.getId());

		verify(jobManager).delete(existing.getId());
		verify(repository).delete(existing);
	}

	@Test
	void disabledSchedulingIsStoredDisabled() {
		SchedulingRequest request = new SchedulingRequest("x", " ", "LOG", Map.of("message", "m"), EVERY_5_MIN, false,
				null);

		service.create(request);

		ArgumentCaptor<Scheduling> saved = ArgumentCaptor.forClass(Scheduling.class);
		verify(repository).saveAndFlush(saved.capture());
		assertThat(saved.getValue().isEnabled()).isFalse();
		assertThat(saved.getValue().getDescription()).isNull();
	}

	@Test
	void previewValidatesAndReturnsFireTimes() {
		assertThat(service.preview(EVERY_5_MIN).nextFireTimes()).hasSize(SchedulingService.PREVIEW_COUNT)
			.first()
			.isEqualTo(NOW.plusSeconds(300));
		assertThatThrownBy(() -> service.preview(new CronSchedule("nope", "UTC")))
			.isInstanceOf(ValidationException.class);
	}

	private static SchedulingRequest request(String name, Map<String, Object> parameters, IntervalSchedule schedule,
			Long version) {
		return new SchedulingRequest(name, null, "LOG", parameters, schedule, true, version);
	}

	private static SchedulingRequest request(String name, Map<String, Object> parameters, CronSchedule schedule,
			Long version) {
		return new SchedulingRequest(name, null, "LOG", parameters, schedule, true, version);
	}

	private static Scheduling existing(long version) {
		Scheduling scheduling = new Scheduling(UUID.randomUUID());
		scheduling.setName("Existing");
		scheduling.setTaskKey("LOG");
		scheduling.setParameters(Map.of("message", "old"));
		scheduling.setSchedule(EVERY_5_MIN);
		ReflectionTestUtils.setField(scheduling, "version", version);
		return scheduling;
	}
}
