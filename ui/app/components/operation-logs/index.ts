import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import ApiService from 'waypoint/services/api';
import { inject as service } from '@ember/service';
import { GetJobStreamRequest, GetJobStreamResponse } from 'waypoint-pb';

interface OperationLogsArgs {
  jobId: string;
}

export default class OperationLogs extends Component<OperationLogsArgs> {
  @service api!: ApiService;

  @tracked logLines: object[];
  @tracked isFollowingLogs = true;

  // https://github.com/hashicorp/waypoint-plugin-sdk/blob/baf566811af680c5df138f9915d756f67d271b1a/terminal/ui.go#L126-L135
  headerStyle = 'header';
  errorStyle = 'error';
  errorBoldStyle = 'error-bold';
  warningStyle = 'warning';
  warningBoldStyle = 'warning-bold';
  infoStyle = 'info';
  successStyle = 'success';
  successBoldStyle = 'success-bold';

  typeLine = 'line';
  typeStep = 'step';
  typeStepGroup = 'step-group';
  typeStatus = 'status';

  constructor(owner: any, args: any) {
    super(owner, args);
    this.logLines = [];
    this.start();
  }

  addLogLine(t: string, logLine: object) {
    this.logLines = [...this.logLines, { type: t, logLine: logLine }];
  }

  @action
  initialScroll(element: any) {
    element.scrollIntoView();
  }

  @action
  followLogs(element: any) {
    element.target.parentElement.scroll(0, element.target.parentElement.scrollHeight);
  }

  @action
  newLineAdded(element: any) {
    if (this.isFollowingLogs === true) {
      element.scrollIntoView();
    }
  }

  @action
  onScroll(element: any) {
    if (element.target.scrollHeight - element.target.offsetHeight === element.target.scrollTop) {
      this.isFollowingLogs = true;
    } else {
      this.isFollowingLogs = false;
    }
  }

  async start() {
    const onData = (response: GetJobStreamResponse) => {
      let event = response.getEventCase();

      // We only care about the terminal event
      if (event == GetJobStreamResponse.EventCase.TERMINAL) {
        let terminal = response.getTerminal();
        if (!terminal) {
          if (this.logLines.length === 0) {
            this.addLogLine(this.typeStatus, { msg: 'Logs are no longer available for this operation' });
          }
        } else {
          terminal.getEventsList().forEach((event) => {
            const line = event.getLine();
            const step = event.getStep();

            if (line && line.getMsg()) {
              console.log(line);
              this.addLogLine(this.typeLine, line.toObject());
            }

            if (step && step.getOutput()) {
              console.log(step);
              const newStep = step.toObject();

              if (step.getOutput_asU8().length > 0) {
                newStep.output = new TextDecoder().decode(step.getOutput_asU8());
              }

              this.addLogLine(this.typeStep, newStep);
            }
          });
        }
      }
    };

    const onStatus = (status: any) => {
      if (status.details) {
        this.addLogLine(this.typeStatus, { msg: status.details });
      }
    };

    let req = new GetJobStreamRequest();
    req.setJobId(this.args.jobId);
    let stream = this.api.client.getJobStream(req, this.api.WithMeta());

    stream.on('data', onData);
    stream.on('status', onStatus);
  }
}
