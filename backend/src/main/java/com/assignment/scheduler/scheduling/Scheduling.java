package com.assignment.scheduler.scheduling;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A scheduled execution of a predefined task. The matching Quartz job/trigger is keyed by {@link #getId()} and
 * is kept in sync by {@code SchedulingService} within the same transaction.
 */
@Entity
@Table(name = "scheduling")
public class Scheduling {

	@Id
	private UUID id;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(length = 500)
	private String description;

	@Column(name = "task_key", nullable = false, length = 50)
	private String taskKey;

	@Convert(converter = ParametersConverter.class)
	@Column(nullable = false, columnDefinition = "text")
	private Map<String, Object> parameters = Map.of();

	@Convert(converter = ScheduleSpecConverter.class)
	@Column(nullable = false, columnDefinition = "text")
	private ScheduleSpec schedule;

	@Column(nullable = false)
	private boolean enabled = true;

	@Version
	private Long version;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Scheduling() {
		// for JPA
	}

	public Scheduling(UUID id) {
		this.id = id;
	}

	@PrePersist
	void onCreate() {
		createdAt = Instant.now();
		updatedAt = createdAt;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getTaskKey() {
		return taskKey;
	}

	public void setTaskKey(String taskKey) {
		this.taskKey = taskKey;
	}

	public Map<String, Object> getParameters() {
		return parameters;
	}

	public void setParameters(Map<String, Object> parameters) {
		this.parameters = Map.copyOf(parameters);
	}

	public ScheduleSpec getSchedule() {
		return schedule;
	}

	public void setSchedule(ScheduleSpec schedule) {
		this.schedule = schedule;
	}

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	public Long getVersion() {
		return version;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
