Clients = new Mongo.Collection('Clients');
Jobs = new Mongo.Collection('Jobs');
Tasks = new Mongo.Collection('Tasks');
SelectedJobs = new Mongo.Collection('SelectedJobs');

if (Meteor.isClient) {
  Meteor.subscribe('clients');
  Meteor.subscribe('jobs');
  Meteor.subscribe('tasks');
  Meteor.subscribe('selectedJobs');

  $(document).ready(function() {
    Meteor.call('pullData');
  });

  // clear data on page load
  Template.body.rendered = function() {
    Meteor.call('clearData');
  }

  // find jobs by task name
  Template.body.events({
    'click #find_task': function() {
      Meteor.call('findTask', $('#task_name').val(), function(error, result) {
        Meteor.call('findJobs', result);
      });
    }
  });

  // return list of jobs from task name
  Template.body.helpers({
    selectedJobs: function() {
      var selectedJobs = [];
      SelectedJobs.find().forEach(function(job, index, cursor) {
        selectedJobs.push(job);
      });
      return selectedJobs;
    }
  });

  Template.task_input.helpers({
    settings: function() {
      return {
        position: "bottom",
        limit: 5,
        rules: [
          {
            token: '',
            collection: Tasks,
            field: "Name",
            template: Template.autocomplete
          }
        ]
      };
    }
  });
}

if (Meteor.isServer) {
  Meteor.publish('clients', function() {
    return Clients.find();
  });
  Meteor.publish('jobs', function() {
    return Jobs.find();
  });
  Meteor.publish('tasks', function() {
    return Tasks.find();
  });
  Meteor.publish('selectedJobs', function() {
    return SelectedJobs.find();
  });

  Meteor.methods({
    // remove client, job, task data
    clearData: function() {
      Clients.remove({});
      Jobs.remove({});
      Tasks.remove({});
      SelectedJobs.remove({});
    },

    // retrieve client, job, and task data from clicktime api
    pullData: function() {
      var apibase = 'https://clicktime.herokuapp.com/api/1.0';

      var company_id;
      var user_id;

      // get company and user ids
      HTTP.get(apibase + '/Session', function(error, result) {
        var response = result.data;
        company_id = response.CompanyID;
        user_id = response.UserID;

        // get client list
        HTTP.get(apibase + '/Companies/' + company_id +'/Users/' + user_id +'/Clients', function(error, result) {
          var clients = result.data;
          for (client_index = 0; client_index < clients.length; client_index++) {
            Clients.insert(clients[client_index]);
          }
        });

        // get job list
        HTTP.get(apibase + '/Companies/' + company_id +'/Users/' + user_id +'/Jobs?withChildIDs=true', function(error, result) {
          var jobs = result.data;
          for (job_index = 0; job_index < jobs.length; job_index++) {
            Jobs.insert(jobs[job_index]);
          }
        });

        // get task list
        HTTP.get(apibase + '/Companies/' + company_id +'/Users/' + user_id +'/Tasks', function(error, result) {
          var tasks = result.data;
          for (task_index = 0; task_index < tasks.length; task_index++) {
            Tasks.insert(tasks[task_index]);
          }
        });
      });
    },

    // get jobs associated with task
    findTask: function(task_name) {
      var task = Tasks.findOne({ Name: task_name });
      if (task) {
        var task_id = task.TaskID;
        var permitted_jobs = [];
        var jobs = Jobs.find();
        jobs.forEach(function(job, index, cursor) {
          var permitted_tasks = job.PermittedTasks;
          if (permitted_tasks.search(task_id) != -1) {
            permitted_jobs.push(job);
          }
        });
        return permitted_jobs;
      }
    },

    // find jobs and clients with job id and add to SelectedJobs
    findJobs: function(permitted_jobs) {
      SelectedJobs.remove({});
      if (permitted_jobs) {
        for (i = 0; i < permitted_jobs.length; i++) {
          var job = permitted_jobs[i]
          var client = Clients.findOne({ ClientID: job.ClientID });
          SelectedJobs.insert({ JobName: job.DisplayName, JobID: job.JobID, ClientName: client.DisplayName, ClientID: client.ClientID });
        }
      }
    }
  });

}

