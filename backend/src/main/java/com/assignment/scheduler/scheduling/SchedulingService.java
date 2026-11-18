package com.assignment.scheduler.scheduling;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.assignment.scheduler.common.ConflictException;
import com.assignment.scheduler.common.NotFoundException;
import com.assignment.scheduler.common.ValidationException;
import com.assignment.scheduler.quartz.JobState;
import com.assignment.scheduler.quartz.QuartzJobManager;
import com.assignment.scheduler.quartz.TriggerFactory;
import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;
import com.assignment.scheduler.task.ParameterValidator;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskRegistry;

/**
 * Scheduling use cases. Every write touches both the {@code scheduling} table and the Quartz job store inside one
 * transaction, so the two can never drift apart.
 */
@Service
@Transactional
public class SchedulingService {

	static final int PREVIEW_COUNT = 5;

	private static final Logger log = LoggerFactory.getLogger(SchedulingService.class);

	private final SchedulingRepository repository;

	private final TaskRegistry taskRegistry;

	private final ParameterValidator parameterValidator;

	private final TriggerFactory triggerFactory;

	private final QuartzJobManager jobManager;

	public SchedulingService(SchedulingRepository repository, TaskRegistry taskRegistry,
			ParameterValidator parameterValidator, TriggerFactory triggerFactory, QuartzJobManager jobManager) {
		this.repository = repository;
		this.taskRegistry = taskRegistry;
		this.parameterValidator = parameterValidator;
		this.triggerFactory = triggerFactory;
		this.jobManager = jobManager;
	}

	@Transactional(readOnly = true)
	public List<SchedulingResponse> findAll() {
		return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public SchedulingResponse get(UUID id) {
		return toResponse(load(id));
	}

	public SchedulingResponse create(SchedulingRequest request) {
		Scheduling scheduling = new Scheduling(UUID.randomUUID());
		apply(scheduling, request);
		repository.saveAndFlush(scheduling);
		jobManager.schedule(scheduling);
		log.info("Created scheduling {} (task {})", scheduling.getId(), scheduling.getTaskKey());
		return toResponse(scheduling);
	}

	public SchedulingResponse update(UUID id, SchedulingRequest request) {
		Scheduling scheduling = load(id);
		if (request.version() == null) {
			throw ValidationException.of("version", "is required when updating");
		}
		if (!Objects.equals(request.version(), scheduling.getVersion())) {
			throw new ConflictException("Scheduling " + id + " was modified by someone else");
		}
		apply(scheduling, request);
		repository.saveAndFlush(scheduling);
		jobManager.schedule(scheduling);
		log.info("Updated scheduling {} (task {})", id, scheduling.getTaskKey());
		return toResponse(scheduling);
	}

	public void delete(UUID id) {
		Scheduling scheduling = load(id);
		jobManager.delete(id);
		repository.delete(scheduling);
		log.info("Deleted scheduling {}", id);
	}

	@Transactional(readOnly = true)
	public PreviewResponse preview(ScheduleSpec schedule) {
		Map<String, String> errors = triggerFactory.validate(schedule);
		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		return new PreviewResponse(triggerFactory.preview(schedule, PREVIEW_COUNT));
	}

	/** Validates the whole request up front so the client gets every field error in one response. */
	private void apply(Scheduling scheduling, SchedulingRequest request) {
		Map<String, String> errors = new LinkedHashMap<>();
		ScheduledTask task = taskRegistry.find(request.taskKey()).orElse(null);
		Map<String, Object> parameters = Map.of();
		if (task == null) {
			errors.put("taskKey", "is not a known task");
		}
		else {
			parameters = parameterValidator.validate(task, request.parameters(), errors);
		}
		errors.putAll(triggerFactory.validate(request.schedule()));
		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		scheduling.setName(request.name().strip());
		scheduling.setDescription(
				request.description() == null || request.description().isBlank() ? null : request.description().strip());
		scheduling.setTaskKey(task.key());
		scheduling.setParameters(parameters);
		scheduling.setSchedule(request.schedule());
		scheduling.setEnabled(request.enabled() == null || request.enabled());
	}

	private Scheduling load(UUID id) {
		return repository.findById(id).orElseThrow(() -> new NotFoundException("Scheduling " + id + " not found"));
	}

	private SchedulingResponse toResponse(Scheduling s) {
		JobState state = jobManager.state(s.getId());
		String taskName = taskRegistry.find(s.getTaskKey()).map(ScheduledTask::name).orElse(s.getTaskKey());
		return new SchedulingResponse(s.getId(), s.getName(), s.getDescription(), s.getTaskKey(), taskName,
				s.getParameters(), s.getSchedule(), s.isEnabled(), state.status(), state.nextFireTime(),
				s.getVersion(), s.getCreatedAt(), s.getUpdatedAt());
	}
}
