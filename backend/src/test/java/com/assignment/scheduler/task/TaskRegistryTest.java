package com.assignment.scheduler.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.assignment.scheduler.task.impl.EmailTask;
import com.assignment.scheduler.task.impl.LogTask;

class TaskRegistryTest {

	@Test
	void listsTasksSortedByName() {
		TaskRegistry registry = new TaskRegistry(List.of(new LogTask(), new EmailTask()));

		assertThat(registry.all()).extracting(ScheduledTask::name)
			.containsExactly("Log message", "Send email (simulated)");
	}

	@Test
	void findsTasksByKey() {
		TaskRegistry registry = new TaskRegistry(List.of(new LogTask()));

		assertThat(registry.find("LOG")).get().isInstanceOf(LogTask.class);
		assertThat(registry.find("NOPE")).isEmpty();
		assertThat(registry.find(null)).isEmpty();
	}

	@Test
	void failsFastOnDuplicateKeys() {
		assertThatThrownBy(() -> new TaskRegistry(List.of(new LogTask(), new LogTask())))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("Duplicate task key: LOG");
	}

	@Test
	void everyTaskSchemaIsWellFormed() {
		TaskRegistry registry = new TaskRegistry(List.of(new LogTask(), new EmailTask()));

		assertThat(registry.all()).allSatisfy(task -> assertThat(task.parameters()).allSatisfy(p -> {
			assertThat(p.name()).isNotBlank();
			assertThat(p.label()).isNotBlank();
			if (p.type() == ParameterType.ENUM) {
				assertThat(p.options()).isNotEmpty();
			}
		}));
	}
}
