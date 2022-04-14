import React from 'react';
import PropTypes from 'prop-types';
import {
    Button,
    EmptyState, EmptyStateBody,
    Form, FormGroup, FormFieldGroup, FormFieldGroupHeader,
    FormSelect, FormSelectOption,
    Grid,
    HelperText, HelperTextItem,
    Modal, Radio,
    TextInput, Tabs, Tab, TabTitleText,
    Popover,
} from '@patternfly/react-core';
import { MinusIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import * as dockerNames from 'docker-names';

import { ErrorNotification } from './Notification.jsx';
import * as client from './client.js';
import cockpit from 'cockpit';
import { DialogsContext } from "dialogs.jsx";

import "./PodCreateModal.scss";

const _ = cockpit.gettext;

const systemOwner = "system";

const PublishPort = ({ id, item, onChange, idx, removeitem, itemCount }) =>
    (
        <Grid hasGutter id={id}>
            <FormGroup className="pf-m-4-col-on-md"
                label={_("IP address")}
                fieldId={id + "-ip-address"}
                labelIcon={
                    <Popover aria-label={_("IP address help")}
                        enableFlip
                        bodyContent={_("If host IP is set to 0.0.0.0 or not set at all, the port will be bound on all IPs on the host.")}>
                        <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                            <OutlinedQuestionCircleIcon />
                        </button>
                    </Popover>
                }>
                <TextInput id={id + "-ip-address"}
                        value={item.IP || ''}
                        onChange={value => onChange(idx, 'IP', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                    label={_("Host port")}
                    fieldId={id + "-host-port"}
                    labelIcon={
                        <Popover aria-label={_("Host port help")}
                            enableFlip
                            bodyContent={_("If the host port is not set the container port will be randomly assigned a port on the host.")}>
                            <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                <OutlinedQuestionCircleIcon />
                            </button>
                        </Popover>
                    }>
                <TextInput id={id + "-host-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.hostPort || ''}
                            onChange={value => onChange(idx, 'hostPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-3-col-on-md"
                        label={_("Container port")}
                        fieldId={id + "-container-port"} isRequired>
                <TextInput id={id + "-container-port"}
                            type='number'
                            step={1}
                            min={1}
                            max={65535}
                            value={item.containerPort || ''}
                            onChange={value => onChange(idx, 'containerPort', value)} />
            </FormGroup>
            <FormGroup className="pf-m-2-col-on-md"
                        label={_("Protocol")}
                        fieldId={id + "-protocol"}>
                <FormSelect className='pf-c-form-control container-port-protocol'
                            id={id + "-protocol"}
                            value={item.protocol}
                            onChange={value => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </FormGroup>
            <FormGroup className="pf-m-1-col-on-md remove-button-group">
                <Button variant='secondary'
                            className="btn-close"
                            id={id + "-btn-close"}
                            isSmall
                            aria-label={_("Remove item")}
                            icon={<MinusIcon />}
                            onClick={() => removeitem(idx)} />
            </FormGroup>
        </Grid>
    );

class DynamicListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
        };
        this.keyCounter = 0;
        this.removeItem = this.removeItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.onItemChange = this.onItemChange.bind(this);
    }

    removeItem(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items.splice(idx, 1);
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    addItem() {
        this.setState(state => {
            return { list: [...state.list, Object.assign({ key: this.keyCounter++ }, this.props.default)] };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    onItemChange(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items[idx][field] = value || null;
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    render () {
        const { id, label, actionLabel, formclass, emptyStateString, helperText } = this.props;
        const dialogValues = this.state;
        return (
            <FormFieldGroup header={
                <FormFieldGroupHeader
                    titleText={{ text: label }}
                    actions={<Button variant="secondary" className="btn-add" onClick={this.addItem}>{actionLabel}</Button>}
                />
            } className={"dynamic-form-group " + formclass}>
                {
                    dialogValues.list.length
                        ? <>
                            {dialogValues.list.map((item, idx) => {
                                return React.cloneElement(this.props.itemcomponent, {
                                    idx: idx, item: item, id: id + "-" + idx,
                                    key: idx,
                                    onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                    itemCount: Object.keys(dialogValues.list).length,
                                });
                            })
                            }
                            {helperText &&
                            <HelperText>
                                <HelperTextItem>{helperText}</HelperTextItem>
                            </HelperText>
                            }
                        </>
                        : <EmptyState>
                            <EmptyStateBody>
                                {emptyStateString}
                            </EmptyStateBody>
                        </EmptyState>
                }
            </FormFieldGroup>
        );
    }
}
DynamicListForm.propTypes = {
    emptyStateString: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    id: PropTypes.string.isRequired,
    itemcomponent: PropTypes.object.isRequired,
    formclass: PropTypes.string,
    options: PropTypes.object,
};

export class PodCreateModal extends React.Component {
    static contextType = DialogsContext;

    constructor(props) {
        super(props);

        this.state = {
            podName: dockerNames.getRandomName(),
            publish: [],
            validationFailed: {},
            activeTabKey: 0,
            owner: this.props.systemServiceAvailable ? systemOwner : this.props.user,
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    getCreateConfig() {
        const createConfig = {};

        if (this.state.podName)
            createConfig.name = this.state.podName;

        if (this.state.publish.length > 0)
            createConfig.portmappings = this.state.publish
                    .filter(port => port.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });

        return createConfig;
    }

    createPod = (isSystem, createConfig) => {
        const Dialogs = this.context;
        client.createPod(isSystem, createConfig)
                .then(() => Dialogs.close())
                .catch(ex => {
                    this.setState({
                        dialogError: _("Pod failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    }

    async onCreateClicked() {
        const createConfig = this.getCreateConfig();
        const isSystem = this.isSystem();

        this.createPod(isSystem, createConfig);
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    handleTabClick = (event, tabIndex) => {
        // Prevent the form from being submitted.
        event.preventDefault();
        this.setState({
            activeTabKey: tabIndex,
        });
    };

    handleOwnerSelect = (_, event) => {
        const value = event.currentTarget.value;
        this.setState({
            owner: value
        });
    }

    enablePodmanRestartService = () => {
        const argv = ["systemctl", "enable", "podman-restart.service"];

        cockpit.spawn(argv, { superuser: "require", err: "message" })
                .catch(err => {
                    console.warn("Failed to start podman-restart.service:", JSON.stringify(err));
                });
    }

    isSystem = () => {
        const { owner } = this.state;
        return owner === systemOwner;
    }

    render() {
        const dialogValues = this.state;
        const { activeTabKey, owner } = this.state;
        const Dialogs = this.context;

        const defaultBody = (
            <Form>
                <FormGroup fieldId='create-pod-dialog-name' label={_("Name")} className="ct-m-horizontal">
                    <TextInput id='create-pod-dialog-name'
                           className="pod-name"
                           placeholder={_("Pod name")}
                           value={dialogValues.podName}
                           onChange={value => this.onValueChanged('podName', value)} />
                </FormGroup>
                <Tabs activeKey={activeTabKey} onSelect={this.handleTabClick}>
                    <Tab eventKey={0} title={<TabTitleText>{_("Details")}</TabTitleText>} className="pf-c-form pf-m-horizontal">
                        { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                        <FormGroup isInline hasNoPaddingTop fieldId='create-pod-dialog-owner' label={_("Owner")}>
                            <Radio value="system"
                                   label={_("System")}
                                   id="create-pod-dialog-owner-system"
                                   isChecked={owner === "system"}
                                   onChange={this.handleOwnerSelect} />
                            <Radio value={this.props.user}
                                   label={cockpit.format("$0 $1", _("User:"), this.props.user)}
                                   id="create-pod-dialog-owner-user"
                                   isChecked={owner === this.props.user}
                                   onChange={this.handleOwnerSelect} />
                        </FormGroup>
                        }

                    </Tab>
                    <Tab eventKey={1} title={<TabTitleText>{_("Integration")}</TabTitleText>} id="create-image-dialog-tab-integration" className="pf-c-form">

                        <DynamicListForm id='create-pod-dialog-publish'
                                 emptyStateString={_("No ports exposed")}
                                 formclass='publish-port-form'
                                 label={_("Port mapping")}
                                 actionLabel={_("Add port mapping")}
                                 onChange={value => this.onValueChanged('publish', value)}
                                 default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                 itemcomponent={ <PublishPort />} />

                    </Tab>
                </Tabs>
            </Form>
        );

        return (
            <Modal isOpen
                   position="top" variant="medium"
                   // TODO: still not ideal on chromium https://github.com/patternfly/patternfly-react/issues/6471
                   onEscapePress={() => {
                       if (this.state.isImageSelectOpen) {
                           this.onImageSelectToggle(!this.state.isImageSelectOpen);
                       } else {
                           Dialogs.close();
                       }
                   }}
                   title={_("Create pod")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' id="create-pod-create-btn" onClick={() => this.onCreateClicked(false)}>
                           {_("Create")}
                       </Button>
                       <Button variant='link' className='btn-cancel' onClick={Dialogs.close}>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {defaultBody}
            </Modal>
        );
    }
}
