package com.assignment.scheduler.task;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only catalog of predefined tasks. There are deliberately no write endpoints. */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

	public record TaskResponse(String key, String name, String description, List<ParameterDefinition> parameters) {
	}

	private final TaskRegistry taskRegistry;

	public TaskController(TaskRegistry taskRegistry) {
		this.taskRegistry = taskRegistry;
	}

	@GetMapping
	public List<TaskResponse> list() {
		return taskRegistry.all().stream()
			.map(task -> new TaskResponse(task.key(), task.name(), task.description(), task.parameters()))
			.toList();
	}
}
